"""
Audit logging for leave management actions.

Logs all admin actions for compliance and security tracking.
"""
import logging
from django.utils import timezone

# Get the security logger
security_logger = logging.getLogger('accounts.security')
leave_logger = logging.getLogger('apps.leave.audit')


def log_leave_action(
    action: str,
    admin_user,
    target_user=None,
    leave_request=None,
    leave_balance=None,
    details: dict = None,
    ip_address: str = None
):
    """
    Log an audit entry for leave management actions.
    
    Args:
        action: The action performed (e.g., 'APPROVE', 'REJECT', 'DELETE', 'BALANCE_UPDATE')
        admin_user: The admin who performed the action
        target_user: The user affected by the action (optional)
        leave_request: The leave request involved (optional)
        leave_balance: The leave balance involved (optional)
        details: Additional details as a dictionary (optional)
        ip_address: The IP address of the admin (optional)
    """
    timestamp = timezone.now().isoformat()
    
    log_data = {
        'timestamp': timestamp,
        'action': action,
        'admin_id': admin_user.id,
        'admin_username': admin_user.username,
        'admin_email': admin_user.email,
    }
    
    if target_user:
        log_data['target_user_id'] = target_user.id
        log_data['target_username'] = target_user.username
    
    if leave_request:
        log_data['leave_request_id'] = leave_request.id
        log_data['leave_type'] = leave_request.leave_type
        log_data['leave_status'] = leave_request.status
        log_data['leave_start_date'] = str(leave_request.start_date)
        log_data['leave_end_date'] = str(leave_request.end_date)
    
    if leave_balance:
        log_data['leave_balance_id'] = leave_balance.id
        log_data['vacation_hours'] = str(leave_balance.vacation_hours)
        log_data['overtime_hours'] = str(leave_balance.overtime_hours)
    
    if details:
        log_data['details'] = details
    
    if ip_address:
        log_data['ip_address'] = ip_address
    
    # Format log message
    message = f"LEAVE_AUDIT | {action} | admin={admin_user.username} | "
    
    if target_user:
        message += f"target={target_user.username} | "
    
    if leave_request:
        message += f"request_id={leave_request.id} type={leave_request.leave_type} | "
    
    if details:
        message += f"details={details}"
    
    # Log to both security and leave audit loggers
    security_logger.info(message)
    leave_logger.info(message)


def get_client_ip(request):
    """
    Get the client IP address from the request.
    Handles proxied requests (X-Forwarded-For header).
    """
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


# Action constants
class LeaveAuditAction:
    """Constants for leave audit actions."""
    REQUEST_APPROVED = 'LEAVE_REQUEST_APPROVED'
    REQUEST_REJECTED = 'LEAVE_REQUEST_REJECTED'
    REQUEST_DELETED = 'LEAVE_REQUEST_DELETED'
    REQUEST_UPDATED = 'LEAVE_REQUEST_UPDATED'
    BALANCE_UPDATED = 'LEAVE_BALANCE_UPDATED'
    BALANCE_CREATED = 'LEAVE_BALANCE_CREATED'
    SETTINGS_UPDATED = 'LEAVE_SETTINGS_UPDATED'
    REQUEST_CANCELLED = 'LEAVE_REQUEST_CANCELLED'
