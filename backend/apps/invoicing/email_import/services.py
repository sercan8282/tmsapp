"""
Email Import Services

Services for reading emails from shared mailboxes and processing PDF attachments.
"""
import imaplib
import email
from email.header import decode_header
import logging
import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from django.conf import settings
from django.core.files.base import ContentFile
from django.utils import timezone
from django.db import transaction

logger = logging.getLogger(__name__)


class EmailReaderBase:
    """Base class for email readers."""
    
    def connect(self) -> bool:
        """Connect to the mail server."""
        raise NotImplementedError
    
    def disconnect(self):
        """Disconnect from the mail server."""
        raise NotImplementedError
    
    def list_folders(self) -> List[Dict]:
        """List available folders in the mailbox."""
        raise NotImplementedError
    
    def fetch_emails(self, folder: str = 'INBOX', only_unread: bool = True,
                     subject_filter: str = '', sender_filter: str = '',
                     limit: int = 50) -> List[Dict]:
        """Fetch emails from the specified folder."""
        raise NotImplementedError
    
    def mark_as_read(self, message_id: str):
        """Mark an email as read."""
        raise NotImplementedError
    
    def move_email(self, message_id: str, target_folder: str):
        """Move an email to another folder."""
        raise NotImplementedError


class IMAPEmailReader(EmailReaderBase):
    """IMAP email reader for reading from shared mailboxes."""
    
    def __init__(self, server: str, port: int, username: str, password: str, 
                 use_ssl: bool = True, email_address: str = None):
        self.server = server
        self.port = port
        self.username = username
        self.password = password
        self.use_ssl = use_ssl
        self.email_address = email_address  # Shared mailbox address
        self.connection: Optional[imaplib.IMAP4_SSL] = None
    
    def connect(self) -> bool:
        """Connect to the IMAP server."""
        try:
            if self.use_ssl:
                self.connection = imaplib.IMAP4_SSL(self.server, self.port)
            else:
                self.connection = imaplib.IMAP4(self.server, self.port)
            
            # For shared mailboxes in Microsoft 365, use: user@domain.com\shared@domain.com
            login_user = self.username
            if self.email_address and self.email_address != self.username:
                # Shared mailbox format for Exchange/Microsoft 365
                login_user = f"{self.username}\\{self.email_address}"
            
            self.connection.login(login_user, self.password)
            logger.info(f"Successfully connected to {self.server}")
            return True
        except Exception as e:
            logger.error(f"Failed to connect to IMAP server: {e}")
            raise
    
    def disconnect(self):
        """Disconnect from the IMAP server."""
        if self.connection:
            try:
                self.connection.logout()
            except Exception:
                pass
            self.connection = None
    
    def list_folders(self) -> List[Dict]:
        """List available folders in the mailbox."""
        if not self.connection:
            raise RuntimeError("Not connected to IMAP server")
        
        folders = []
        
        try:
            status, folder_list = self.connection.list()
            if status != 'OK':
                return folders
            
            for folder_data in folder_list:
                if isinstance(folder_data, bytes):
                    # Parse folder response: (\\Flags) "delimiter" "folder_name"
                    decoded = folder_data.decode('utf-8', errors='replace')
                    
                    # Extract folder name (last part after delimiter)
                    # Format: (\HasNoChildren) "/" "INBOX/Subfolder"
                    match = re.search(r'"([^"]+)"\s+"?([^"]+)"?$', decoded)
                    if match:
                        delimiter = match.group(1)
                        folder_name = match.group(2).strip('"')
                        
                        # Calculate depth based on delimiter
                        depth = folder_name.count(delimiter) if delimiter else 0
                        
                        # Get display name (last part)
                        display_name = folder_name.split(delimiter)[-1] if delimiter else folder_name
                        
                        folders.append({
                            'id': folder_name,
                            'name': folder_name,
                            'display_name': display_name,
                            'depth': depth,
                            'has_children': '\\HasChildren' in decoded
                        })
            
            # Sort folders alphabetically
            folders.sort(key=lambda x: x['name'].lower())
            
            return folders
        
        except Exception as e:
            logger.error(f"Error listing folders: {e}")
            raise
    
    def _decode_header(self, header_value: str) -> str:
        """Decode an email header value."""
        if not header_value:
            return ''
        
        decoded_parts = []
        for part, encoding in decode_header(header_value):
            if isinstance(part, bytes):
                decoded_parts.append(part.decode(encoding or 'utf-8', errors='replace'))
            else:
                decoded_parts.append(part)
        return ''.join(decoded_parts)
    
    def _parse_date(self, date_str: str) -> Optional[datetime]:
        """Parse email date string to datetime."""
        if not date_str:
            return None
        
        # Common date formats
        formats = [
            '%a, %d %b %Y %H:%M:%S %z',
            '%d %b %Y %H:%M:%S %z',
            '%a, %d %b %Y %H:%M:%S',
            '%d %b %Y %H:%M:%S',
        ]
        
        # Remove parenthetical timezone names
        date_str = re.sub(r'\s*\([^)]+\)\s*$', '', date_str.strip())
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        
        # Fallback
        return timezone.now()
    
    def _extract_attachments(self, msg) -> List[Dict]:
        """Extract PDF attachments from an email message."""
        attachments = []
        
        for part in msg.walk():
            content_disposition = str(part.get('Content-Disposition', ''))
            content_type = part.get_content_type()
            
            # Check if it's an attachment
            if 'attachment' in content_disposition or content_type == 'application/pdf':
                filename = part.get_filename()
                if filename:
                    filename = self._decode_header(filename)
                    
                    # Only process PDF files
                    if filename.lower().endswith('.pdf') or content_type == 'application/pdf':
                        payload = part.get_payload(decode=True)
                        if payload:
                            # Validate PDF magic bytes
                            if payload[:4] == b'%PDF':
                                attachments.append({
                                    'filename': filename,
                                    'content': payload,
                                    'content_type': content_type,
                                    'size': len(payload)
                                })
                            else:
                                logger.warning(f"Skipping {filename}: not a valid PDF")
        
        return attachments
    
    def _get_body_preview(self, msg, max_length: int = 500) -> str:
        """Extract a preview of the email body."""
        body = ''
        
        if msg.is_multipart():
            for part in msg.walk():
                content_type = part.get_content_type()
                if content_type == 'text/plain':
                    payload = part.get_payload(decode=True)
                    if payload:
                        body = payload.decode('utf-8', errors='replace')
                        break
        else:
            payload = msg.get_payload(decode=True)
            if payload:
                body = payload.decode('utf-8', errors='replace')
        
        # Clean and truncate
        body = body.strip()[:max_length]
        if len(body) == max_length:
            body += '...'
        
        return body
    
    def fetch_emails(self, folder: str = 'INBOX', only_unread: bool = True,
                     subject_filter: str = '', sender_filter: str = '',
                     limit: int = 50) -> List[Dict]:
        """Fetch emails from the specified folder."""
        if not self.connection:
            raise RuntimeError("Not connected to IMAP server")
        
        emails = []
        
        try:
            # Select the folder
            status, _ = self.connection.select(folder)
            if status != 'OK':
                raise RuntimeError(f"Failed to select folder: {folder}")
            
            # Build search criteria
            criteria = []
            if only_unread:
                criteria.append('UNSEEN')
            if subject_filter:
                criteria.append(f'SUBJECT "{subject_filter}"')
            if sender_filter:
                criteria.append(f'FROM "{sender_filter}"')
            
            search_criteria = ' '.join(criteria) if criteria else 'ALL'
            
            # Search for emails
            status, message_ids = self.connection.search(None, search_criteria)
            if status != 'OK':
                return emails
            
            ids = message_ids[0].split()
            
            # Limit the number of emails to process
            ids = ids[-limit:] if limit else ids
            
            for msg_id in ids:
                try:
                    status, msg_data = self.connection.fetch(msg_id, '(RFC822)')
                    if status != 'OK':
                        continue
                    
                    raw_email = msg_data[0][1]
                    msg = email.message_from_bytes(raw_email)
                    
                    # Extract message ID (use IMAP UID as fallback)
                    message_id = msg.get('Message-ID', f'imap-{msg_id.decode()}')
                    
                    # Extract attachments (only PDFs)
                    attachments = self._extract_attachments(msg)
                    
                    # Only include emails that have PDF attachments
                    if attachments:
                        emails.append({
                            'imap_uid': msg_id.decode(),
                            'message_id': message_id,
                            'subject': self._decode_header(msg.get('Subject', '')),
                            'from': self._decode_header(msg.get('From', '')),
                            'date': self._parse_date(msg.get('Date', '')),
                            'body_preview': self._get_body_preview(msg),
                            'attachments': attachments
                        })
                
                except Exception as e:
                    logger.error(f"Error processing email {msg_id}: {e}")
                    continue
            
            return emails
        
        except Exception as e:
            logger.error(f"Error fetching emails: {e}")
            raise
    
    def mark_as_read(self, imap_uid: str):
        """Mark an email as read."""
        if not self.connection:
            return
        
        try:
            self.connection.store(imap_uid.encode(), '+FLAGS', '\\Seen')
        except Exception as e:
            logger.error(f"Error marking email as read: {e}")
    
    def move_email(self, imap_uid: str, target_folder: str):
        """Move an email to another folder."""
        if not self.connection:
            return
        
        try:
            # Copy to target folder
            self.connection.copy(imap_uid.encode(), target_folder)
            # Mark original for deletion
            self.connection.store(imap_uid.encode(), '+FLAGS', '\\Deleted')
            self.connection.expunge()
        except Exception as e:
            logger.error(f"Error moving email: {e}")


class Microsoft365EmailReader(EmailReaderBase):
    """
    Microsoft 365 email reader using OAuth2 and Microsoft Graph API.
    Supports shared mailboxes with delegated access.
    """
    
    def __init__(self, client_id: str, client_secret: str, tenant_id: str,
                 email_address: str):
        self.client_id = client_id
        self.client_secret = client_secret
        self.tenant_id = tenant_id
        self.email_address = email_address
        self.access_token = None
    
    def connect(self) -> bool:
        """Get OAuth2 access token for Microsoft Graph API."""
        try:
            import requests
            
            token_url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
            
            data = {
                'grant_type': 'client_credentials',
                'client_id': self.client_id,
                'client_secret': self.client_secret,
                'scope': 'https://graph.microsoft.com/.default'
            }
            
            response = requests.post(token_url, data=data)
            response.raise_for_status()
            
            self.access_token = response.json().get('access_token')
            logger.info("Successfully obtained Microsoft 365 access token")
            return True
        
        except Exception as e:
            logger.error(f"Failed to connect to Microsoft 365: {e}")
            raise
    
    def disconnect(self):
        """Clear the access token."""
        self.access_token = None
    
    def list_folders(self) -> List[Dict]:
        """List available folders in the Microsoft 365 mailbox."""
        if not self.access_token:
            raise RuntimeError("Not connected to Microsoft 365")
        
        import requests
        
        folders = []
        
        try:
            # Get all mail folders (including child folders)
            url = f"https://graph.microsoft.com/v1.0/users/{self.email_address}/mailFolders"
            
            headers = {
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/json'
            }
            
            params = {
                '$top': 100,
                '$select': 'id,displayName,parentFolderId,childFolderCount,totalItemCount,unreadItemCount'
            }
            
            response = requests.get(url, headers=headers, params=params)
            response.raise_for_status()
            
            root_folders = response.json().get('value', [])
            
            def process_folder(folder_data, depth=0, parent_path=''):
                """Process a folder and recursively get child folders."""
                folder_id = folder_data.get('id')
                display_name = folder_data.get('displayName', '')
                
                # Build the path for nested folders
                folder_path = f"{parent_path}/{display_name}" if parent_path else display_name
                
                folders.append({
                    'id': folder_id,
                    'name': folder_path,
                    'display_name': display_name,
                    'depth': depth,
                    'has_children': folder_data.get('childFolderCount', 0) > 0,
                    'total_items': folder_data.get('totalItemCount', 0),
                    'unread_items': folder_data.get('unreadItemCount', 0)
                })
                
                # Get child folders if any
                if folder_data.get('childFolderCount', 0) > 0:
                    child_url = f"https://graph.microsoft.com/v1.0/users/{self.email_address}/mailFolders/{folder_id}/childFolders"
                    child_response = requests.get(child_url, headers=headers, params=params)
                    
                    if child_response.status_code == 200:
                        child_folders = child_response.json().get('value', [])
                        for child in child_folders:
                            process_folder(child, depth + 1, folder_path)
            
            for folder_data in root_folders:
                process_folder(folder_data)
            
            return folders
        
        except Exception as e:
            logger.error(f"Error listing Microsoft 365 folders: {e}")
            raise
    
    def fetch_emails(self, folder: str = 'inbox', only_unread: bool = True,
                     subject_filter: str = '', sender_filter: str = '',
                     limit: int = 50) -> List[Dict]:
        """Fetch emails from Microsoft 365 shared mailbox using Graph API."""
        if not self.access_token:
            raise RuntimeError("Not connected to Microsoft 365")
        
        import requests
        
        emails = []
        
        try:
            # Build the Graph API URL
            base_url = f"https://graph.microsoft.com/v1.0/users/{self.email_address}/mailFolders/{folder}/messages"
            
            # Build filter query
            filters = []
            if only_unread:
                filters.append("isRead eq false")
            if subject_filter:
                filters.append(f"contains(subject, '{subject_filter}')")
            if sender_filter:
                filters.append(f"contains(from/emailAddress/address, '{sender_filter}')")
            
            params = {
                '$top': limit,
                '$orderby': 'receivedDateTime desc',
                '$expand': 'attachments'
            }
            
            if filters:
                params['$filter'] = ' and '.join(filters)
            
            headers = {
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/json'
            }
            
            response = requests.get(base_url, headers=headers, params=params)
            response.raise_for_status()
            
            messages = response.json().get('value', [])
            
            for msg in messages:
                # Check for PDF attachments
                attachments = []
                for att in msg.get('attachments', []):
                    if att.get('contentType') == 'application/pdf' or \
                       att.get('name', '').lower().endswith('.pdf'):
                        
                        # Get attachment content
                        if att.get('@odata.type') == '#microsoft.graph.fileAttachment':
                            content = att.get('contentBytes', '')
                            if content:
                                import base64
                                decoded = base64.b64decode(content)
                                
                                # Validate PDF magic bytes
                                if decoded[:4] == b'%PDF':
                                    attachments.append({
                                        'filename': att.get('name', 'attachment.pdf'),
                                        'content': decoded,
                                        'content_type': att.get('contentType', 'application/pdf'),
                                        'size': att.get('size', len(decoded))
                                    })
                
                if attachments:
                    emails.append({
                        'message_id': msg.get('id'),
                        'subject': msg.get('subject', ''),
                        'from': msg.get('from', {}).get('emailAddress', {}).get('address', ''),
                        'date': datetime.fromisoformat(
                            msg.get('receivedDateTime', '').replace('Z', '+00:00')
                        ) if msg.get('receivedDateTime') else None,
                        'body_preview': msg.get('bodyPreview', '')[:500],
                        'attachments': attachments
                    })
            
            return emails
        
        except Exception as e:
            logger.error(f"Error fetching emails from Microsoft 365: {e}")
            raise
    
    def mark_as_read(self, message_id: str):
        """Mark an email as read in Microsoft 365."""
        if not self.access_token:
            return
        
        import requests
        
        try:
            url = f"https://graph.microsoft.com/v1.0/users/{self.email_address}/messages/{message_id}"
            headers = {
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/json'
            }
            
            requests.patch(url, headers=headers, json={'isRead': True})
        except Exception as e:
            logger.error(f"Error marking email as read in Microsoft 365: {e}")
    
    def move_email(self, message_id: str, target_folder: str):
        """Move an email to another folder in Microsoft 365."""
        if not self.access_token:
            return
        
        import requests
        
        try:
            url = f"https://graph.microsoft.com/v1.0/users/{self.email_address}/messages/{message_id}/move"
            headers = {
                'Authorization': f'Bearer {self.access_token}',
                'Content-Type': 'application/json'
            }
            
            requests.post(url, headers=headers, json={'destinationId': target_folder})
        except Exception as e:
            logger.error(f"Error moving email in Microsoft 365: {e}")


class EmailImportService:
    """
    Main service for importing invoices from emails.
    """
    
    def __init__(self):
        from apps.invoicing.ocr.services import InvoiceImportService
        self.ocr_service = InvoiceImportService()
    
    def _get_reader(self, config) -> EmailReaderBase:
        """Get the appropriate email reader for the config."""
        from .models import MailboxConfig
        
        if config.protocol == MailboxConfig.Protocol.MICROSOFT_365:
            return Microsoft365EmailReader(
                client_id=config.ms365_client_id,
                client_secret=config.ms365_client_secret,
                tenant_id=config.ms365_tenant_id,
                email_address=config.email_address
            )
        else:
            return IMAPEmailReader(
                server=config.imap_server,
                port=config.imap_port,
                username=config.username,
                password=config.password,
                use_ssl=config.imap_use_ssl,
                email_address=config.email_address
            )
    
    def test_connection(self, config) -> Tuple[bool, str]:
        """Test the connection to a mailbox."""
        reader = self._get_reader(config)
        
        try:
            reader.connect()
            reader.disconnect()
            return True, "Verbinding succesvol"
        except Exception as e:
            return False, str(e)
    
    def list_folders(self, config) -> List[Dict]:
        """List available folders in a mailbox."""
        reader = self._get_reader(config)
        
        try:
            reader.connect()
            folders = reader.list_folders()
            reader.disconnect()
            return folders
        except Exception as e:
            logger.error(f"Error listing folders: {e}")
            raise
    
    @transaction.atomic
    def fetch_and_process_emails(self, config, user=None, limit: int = 50) -> Dict:
        """
        Fetch emails from a mailbox and process PDF attachments.
        
        Returns:
            Dict with statistics about the import
        """
        from .models import EmailImport, EmailAttachment, MailboxConfig
        
        reader = self._get_reader(config)
        stats = {
            'emails_found': 0,
            'emails_processed': 0,
            'attachments_found': 0,
            'attachments_processed': 0,
            'errors': []
        }
        
        try:
            reader.connect()
            
            # Fetch emails with PDF attachments
            emails = reader.fetch_emails(
                folder=config.folder_name,
                only_unread=config.only_unread,
                subject_filter=config.subject_filter,
                sender_filter=config.sender_filter,
                limit=limit
            )
            
            stats['emails_found'] = len(emails)
            
            for email_data in emails:
                try:
                    # Check if we already processed this email
                    message_id = email_data['message_id']
                    if EmailImport.objects.filter(
                        mailbox_config=config,
                        email_message_id=message_id
                    ).exists():
                        logger.info(f"Email already processed: {message_id}")
                        continue
                    
                    # Create email import record
                    email_import = EmailImport.objects.create(
                        mailbox_config=config,
                        email_message_id=message_id,
                        email_subject=email_data['subject'][:500],
                        email_from=email_data['from'][:255],
                        email_date=email_data['date'] or timezone.now(),
                        email_body_preview=email_data['body_preview'],
                        status=EmailImport.Status.PROCESSING
                    )
                    
                    stats['attachments_found'] += len(email_data['attachments'])
                    
                    # Process each PDF attachment
                    for attachment in email_data['attachments']:
                        try:
                            # Sanitize filename
                            safe_filename = self._sanitize_filename(attachment['filename'])
                            
                            # Create attachment record
                            email_attachment = EmailAttachment.objects.create(
                                email_import=email_import,
                                original_filename=safe_filename,
                                content_type=attachment['content_type'],
                                file_size=attachment['size']
                            )
                            
                            # Save the file
                            email_attachment.file.save(
                                safe_filename,
                                ContentFile(attachment['content'])
                            )
                            
                            # Process with OCR
                            try:
                                from django.core.files.uploadedfile import InMemoryUploadedFile
                                from io import BytesIO
                                
                                # Create a file-like object for the OCR service
                                file_obj = BytesIO(attachment['content'])
                                file_obj.name = safe_filename
                                file_obj.size = attachment['size']
                                
                                # Use SimpleUploadedFile
                                from django.core.files.uploadedfile import SimpleUploadedFile
                                uploaded_file = SimpleUploadedFile(
                                    name=safe_filename,
                                    content=attachment['content'],
                                    content_type=attachment['content_type']
                                )
                                
                                # Process with OCR
                                invoice_import = self.ocr_service.process_upload(
                                    uploaded_file, 
                                    user
                                )
                                
                                # Link to email attachment
                                email_attachment.invoice_import = invoice_import
                                email_attachment.is_processed = True
                                email_attachment.save()
                                
                                stats['attachments_processed'] += 1
                            
                            except Exception as e:
                                email_attachment.error_message = str(e)
                                email_attachment.save()
                                logger.error(f"OCR processing failed for {safe_filename}: {e}")
                        
                        except Exception as e:
                            logger.error(f"Error processing attachment: {e}")
                            stats['errors'].append(f"Bijlage fout: {str(e)}")
                    
                    # Update email import status
                    email_import.status = EmailImport.Status.AWAITING_REVIEW
                    email_import.processed_at = timezone.now()
                    email_import.save()
                    
                    # Mark email as read if configured
                    if config.mark_as_read:
                        imap_uid = email_data.get('imap_uid', email_data['message_id'])
                        reader.mark_as_read(imap_uid)
                    
                    # Move email if configured
                    if config.move_to_folder:
                        imap_uid = email_data.get('imap_uid', email_data['message_id'])
                        reader.move_email(imap_uid, config.move_to_folder)
                    
                    stats['emails_processed'] += 1
                
                except Exception as e:
                    logger.error(f"Error processing email: {e}")
                    stats['errors'].append(str(e))
            
            # Update config statistics
            config.last_fetch_at = timezone.now()
            config.last_error = ''
            config.total_emails_processed += stats['emails_processed']
            config.total_invoices_imported += stats['attachments_processed']
            config.status = MailboxConfig.Status.ACTIVE
            config.save()
        
        except Exception as e:
            logger.error(f"Email fetch failed: {e}")
            config.last_error = str(e)
            config.status = MailboxConfig.Status.ERROR
            config.save()
            stats['errors'].append(str(e))
        
        finally:
            reader.disconnect()
        
        return stats
    
    def _sanitize_filename(self, filename: str) -> str:
        """Sanitize filename to prevent path traversal and invalid characters."""
        import re
        
        # Remove path components
        filename = Path(filename).name
        
        # Only allow safe characters
        safe_filename = re.sub(r'[^\w\s\-\.]', '', filename)
        safe_filename = safe_filename.replace('..', '')
        
        # Ensure it ends with .pdf
        if not safe_filename.lower().endswith('.pdf'):
            safe_filename += '.pdf'
        
        # If empty, generate a name
        if not safe_filename or safe_filename == '.pdf':
            safe_filename = f"attachment_{uuid.uuid4().hex[:8]}.pdf"
        
        return safe_filename
    
    def approve_import(self, email_import, user, notes: str = '') -> bool:
        """Approve an email import after review."""
        from .models import EmailImport
        
        email_import.status = EmailImport.Status.APPROVED
        email_import.reviewed_by = user
        email_import.reviewed_at = timezone.now()
        email_import.review_notes = notes
        email_import.save()
        
        return True
    
    def reject_import(self, email_import, user, notes: str = '') -> bool:
        """Reject an email import."""
        from .models import EmailImport
        
        email_import.status = EmailImport.Status.REJECTED
        email_import.reviewed_by = user
        email_import.reviewed_at = timezone.now()
        email_import.review_notes = notes
        email_import.save()
        
        return True
