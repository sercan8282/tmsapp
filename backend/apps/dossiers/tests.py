"""Tests voor de dossiers module."""
from django.test import TestCase
from django.core import mail
from rest_framework.test import APIClient
from apps.accounts.models import User
from .models import DossierType, Dossier, DossierReactie, Organisatie, Contactpersoon, DossierMailLog


def _make_user(email, rol='gebruiker', module_permissions=None):
    return User.objects.create_user(
        email=email, password='testpass123',
        username=email.split('@')[0],
        voornaam='Test', achternaam='User',
        rol=rol, module_permissions=module_permissions or [],
    )


class DossierPermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = _make_user('admin@test.com', rol='admin')
        self.manager = _make_user('manager@test.com', module_permissions=['manage_dossiers'])
        self.chauffeur1 = _make_user('chauffeur1@test.com', rol='chauffeur')
        self.chauffeur2 = _make_user('chauffeur2@test.com', rol='chauffeur')
        self.dtype = DossierType.objects.create(naam='Test')
        self.dossier1 = Dossier.objects.create(
            onderwerp='Dossier C1', inhoud='Test', type=self.dtype,
            instuurder=self.admin, betreft_chauffeur=self.chauffeur1,
        )
        self.dossier2 = Dossier.objects.create(
            onderwerp='Dossier C2', inhoud='Test', type=self.dtype,
            instuurder=self.admin, betreft_chauffeur=self.chauffeur2,
        )
        DossierReactie.objects.create(dossier=self.dossier1, auteur=self.admin, tekst='Intern', intern=True)
        DossierReactie.objects.create(dossier=self.dossier1, auteur=self.admin, tekst='Niet intern', intern=False)

    def test_chauffeur_sees_only_own_dossiers(self):
        self.client.force_authenticate(self.chauffeur1)
        resp = self.client.get('/api/dossiers/')
        self.assertEqual(resp.status_code, 200)
        ids = [d['id'] for d in resp.data['results']]
        self.assertIn(str(self.dossier1.id), ids)
        self.assertNotIn(str(self.dossier2.id), ids)

    def test_chauffeur_cannot_see_other_dossier(self):
        self.client.force_authenticate(self.chauffeur1)
        resp = self.client.get(f'/api/dossiers/{self.dossier2.id}/')
        self.assertEqual(resp.status_code, 404)

    def test_chauffeur_cannot_see_internal_reactions(self):
        self.client.force_authenticate(self.chauffeur1)
        resp = self.client.get(f'/api/dossiers/{self.dossier1.id}/reacties/')
        self.assertEqual(resp.status_code, 200)
        for r in resp.data:
            self.assertFalse(r['intern'])

    def test_manager_sees_all_reactions(self):
        self.client.force_authenticate(self.manager)
        resp = self.client.get(f'/api/dossiers/{self.dossier1.id}/reacties/')
        self.assertEqual(resp.status_code, 200)
        interns = [r for r in resp.data if r['intern']]
        self.assertTrue(len(interns) > 0)

    def test_pagination_max_15(self):
        for i in range(20):
            Dossier.objects.create(
                onderwerp=f'D{i}', inhoud='x', type=self.dtype,
                instuurder=self.admin, betreft_chauffeur=self.chauffeur1,
            )
        self.client.force_authenticate(self.admin)
        resp = self.client.get('/api/dossiers/?page=1')
        self.assertEqual(resp.status_code, 200)
        self.assertLessEqual(len(resp.data['results']), 15)

    def test_dossiertype_crud_only_manager(self):
        self.client.force_authenticate(self.chauffeur1)
        resp = self.client.post('/api/dossiers/types/', {'naam': 'Nieuw'})
        self.assertIn(resp.status_code, [403, 401])
        self.client.force_authenticate(self.manager)
        resp = self.client.post('/api/dossiers/types/', {'naam': 'Nieuw'})
        self.assertEqual(resp.status_code, 201)

    def test_dossiertype_list_returns_array(self):
        """DossierType list mag nooit gepagineerd zijn (anders breekt frontend .map())."""
        self.client.force_authenticate(self.manager)
        resp = self.client.get('/api/dossiers/types/')
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.data, list, 'DossierType list moet een array teruggeven, niet gepagineerd')


class OrganisatieTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.manager = _make_user('manager@test.com', module_permissions=['manage_dossiers'])
        self.gewone_user = _make_user('user@test.com')

    def test_create_organisatie(self):
        self.client.force_authenticate(self.manager)
        resp = self.client.post('/api/dossiers/organisaties/', {
            'naam': 'Nationale Nederlanden',
            'email': 'info@nn.nl',
            'telefoon': '010-1234567',
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['naam'], 'Nationale Nederlanden')

    def test_create_organisatie_with_contactpersonen(self):
        self.client.force_authenticate(self.manager)
        resp = self.client.post('/api/dossiers/organisaties/', {
            'naam': 'Testbedrijf BV',
            'contactpersonen': [
                {'naam': 'Jan Jansen', 'email': 'jan@testbedrijf.nl', 'telefoon': '', 'functie': 'Manager'},
                {'naam': 'Piet Pietersen', 'email': 'piet@testbedrijf.nl', 'telefoon': '06-12345678', 'functie': ''},
            ],
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        org = Organisatie.objects.get(naam='Testbedrijf BV')
        self.assertEqual(org.contactpersonen.count(), 2)

    def test_non_manager_cannot_create_organisatie(self):
        self.client.force_authenticate(self.gewone_user)
        resp = self.client.post('/api/dossiers/organisaties/', {'naam': 'Test'}, format='json')
        self.assertIn(resp.status_code, [403, 401])

    def test_organisatie_list_returns_array(self):
        """Organisatie list mag nooit gepagineerd zijn."""
        self.client.force_authenticate(self.manager)
        Organisatie.objects.create(naam='Test Org')
        resp = self.client.get('/api/dossiers/organisaties/')
        self.assertEqual(resp.status_code, 200)
        self.assertIsInstance(resp.data, list, 'Organisatie list moet een array teruggeven')

    def test_unique_naam(self):
        Organisatie.objects.create(naam='Duplicate')
        self.client.force_authenticate(self.manager)
        resp = self.client.post('/api/dossiers/organisaties/', {'naam': 'Duplicate'}, format='json')
        self.assertEqual(resp.status_code, 400)


class ContactpersoonTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.manager = _make_user('manager@test.com', module_permissions=['manage_dossiers'])
        self.org = Organisatie.objects.create(naam='Test Org')

    def test_create_contactpersoon(self):
        self.client.force_authenticate(self.manager)
        resp = self.client.post('/api/dossiers/contactpersonen/', {
            'organisatie': str(self.org.id),
            'naam': 'Klaas Klaassen',
            'email': 'klaas@test.nl',
            'functie': 'Directeur',
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['naam'], 'Klaas Klaassen')

    def test_filter_by_organisatie(self):
        cp = Contactpersoon.objects.create(organisatie=self.org, naam='A', email='a@test.nl')
        other_org = Organisatie.objects.create(naam='Other')
        Contactpersoon.objects.create(organisatie=other_org, naam='B', email='b@test.nl')
        self.client.force_authenticate(self.manager)
        resp = self.client.get(f'/api/dossiers/contactpersonen/?organisatie={self.org.id}')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['naam'], 'A')


class DossierMailTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.manager = _make_user('manager@test.com', module_permissions=['manage_dossiers'])
        self.chauffeur = _make_user('chauffeur@test.com', rol='chauffeur')
        self.dtype = DossierType.objects.create(naam='Test')
        self.org = Organisatie.objects.create(naam='Test Org')
        self.cp1 = Contactpersoon.objects.create(
            organisatie=self.org, naam='Jan', email='jan@test.nl',
        )
        self.cp2 = Contactpersoon.objects.create(
            organisatie=self.org, naam='Piet', email='piet@test.nl',
        )
        self.dossier = Dossier.objects.create(
            onderwerp='Schademelding',
            inhoud='Er is schade opgetreden aan voertuig X.',
            type=self.dtype,
            instuurder=self.manager,
            betreft_chauffeur=self.chauffeur,
            organisatie=self.org,
        )

    def test_mail_uses_dossier_subject_and_content(self):
        self.client.force_authenticate(self.manager)
        resp = self.client.post(
            f'/api/dossiers/{self.dossier.id}/stuur-mail/',
            {
                'ontvangers': [],
                'handmatig': ['extern@test.nl'],
                'onderwerp': self.dossier.onderwerp,
                'inhoud': self.dossier.inhoud,
            },
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        sent = mail.outbox[0]
        self.assertEqual(sent.subject, 'Schademelding')
        self.assertIn('schade opgetreden', sent.body)
        self.assertIn('extern@test.nl', sent.to)

    def test_mail_to_contactpersonen(self):
        self.client.force_authenticate(self.manager)
        resp = self.client.post(
            f'/api/dossiers/{self.dossier.id}/stuur-mail/',
            {
                'ontvangers': [str(self.cp1.id), str(self.cp2.id)],
                'handmatig': [],
                'onderwerp': 'Test',
                'inhoud': 'Inhoud',
            },
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        recipients = mail.outbox[0].to
        self.assertIn('jan@test.nl', recipients)
        self.assertIn('piet@test.nl', recipients)

    def test_mail_combined_contacts_and_manual(self):
        self.client.force_authenticate(self.manager)
        resp = self.client.post(
            f'/api/dossiers/{self.dossier.id}/stuur-mail/',
            {
                'ontvangers': [str(self.cp1.id)],
                'handmatig': ['extra@extern.nl'],
                'onderwerp': 'Gecombineerd',
                'inhoud': 'Test',
            },
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        recipients = mail.outbox[0].to
        self.assertIn('jan@test.nl', recipients)
        self.assertIn('extra@extern.nl', recipients)

    def test_mail_logs_verzending(self):
        self.client.force_authenticate(self.manager)
        self.client.post(
            f'/api/dossiers/{self.dossier.id}/stuur-mail/',
            {
                'ontvangers': [],
                'handmatig': ['log@test.nl'],
                'onderwerp': 'Log test',
                'inhoud': 'Test',
            },
            format='json',
        )
        log = DossierMailLog.objects.filter(dossier=self.dossier).first()
        self.assertIsNotNone(log)
        self.assertIn('log@test.nl', log.ontvangers)
        self.assertEqual(log.onderwerp, 'Log test')

    def test_mail_no_recipients_returns_400(self):
        self.client.force_authenticate(self.manager)
        resp = self.client.post(
            f'/api/dossiers/{self.dossier.id}/stuur-mail/',
            {'ontvangers': [], 'handmatig': [], 'onderwerp': 'Test', 'inhoud': 'Test'},
            format='json',
        )
        self.assertEqual(resp.status_code, 400)

    def test_dossier_detail_includes_contactpersonen(self):
        self.client.force_authenticate(self.manager)
        resp = self.client.get(f'/api/dossiers/{self.dossier.id}/')
        self.assertEqual(resp.status_code, 200)
        contacten = resp.data.get('organisatie_contactpersonen', [])
        self.assertEqual(len(contacten), 2)
        emails = [c['email'] for c in contacten]
        self.assertIn('jan@test.nl', emails)

    def test_dossier_with_organisatie(self):
        """Dossier create serializer accepteert organisatie field."""
        self.client.force_authenticate(self.manager)
        resp = self.client.post('/api/dossiers/', {
            'onderwerp': 'Nieuw met org',
            'inhoud': 'Test',
            'type': str(self.dtype.id),
            'betreft_chauffeur': str(self.chauffeur.id),
            'organisatie': str(self.org.id),
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data.get('organisatie'), str(self.org.id))

    def test_mail_with_type_saves_to_log(self):
        """stuur-mail accepts and saves a type on the mail log."""
        self.client.force_authenticate(self.manager)
        mail_type = DossierType.objects.create(naam='Informatiemail')
        resp = self.client.post(
            f'/api/dossiers/{self.dossier.id}/stuur-mail/',
            {
                'ontvangers': [],
                'handmatig': ['type@test.nl'],
                'onderwerp': 'Type test',
                'inhoud': 'Test',
                'type': str(mail_type.id),
            },
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        log = DossierMailLog.objects.filter(dossier=self.dossier, onderwerp='Type test').first()
        self.assertIsNotNone(log)
        self.assertEqual(log.type, mail_type)

    def test_mail_without_type_saves_null(self):
        """stuur-mail without type saves null on the mail log."""
        self.client.force_authenticate(self.manager)
        resp = self.client.post(
            f'/api/dossiers/{self.dossier.id}/stuur-mail/',
            {
                'ontvangers': [],
                'handmatig': ['notype@test.nl'],
                'onderwerp': 'No type test',
                'inhoud': 'Test',
            },
            format='json',
        )
        self.assertEqual(resp.status_code, 200)
        log = DossierMailLog.objects.filter(dossier=self.dossier, onderwerp='No type test').first()
        self.assertIsNotNone(log)
        self.assertIsNone(log.type)

    def test_mail_with_invalid_type_returns_400(self):
        """stuur-mail with non-existent type ID returns 400."""
        self.client.force_authenticate(self.manager)
        import uuid as _uuid
        resp = self.client.post(
            f'/api/dossiers/{self.dossier.id}/stuur-mail/',
            {
                'ontvangers': [],
                'handmatig': ['type@test.nl'],
                'onderwerp': 'Bad type',
                'inhoud': 'Test',
                'type': str(_uuid.uuid4()),
            },
            format='json',
        )
        self.assertEqual(resp.status_code, 400)

    def test_dossier_detail_maillog_includes_type(self):
        """Maillog in dossier detail response includes type fields."""
        self.client.force_authenticate(self.manager)
        mail_type = DossierType.objects.create(naam='Statusupdate')
        DossierMailLog.objects.create(
            dossier=self.dossier,
            verzonden_door=self.manager,
            ontvangers='a@b.nl',
            onderwerp='Check',
            type=mail_type,
        )
        resp = self.client.get(f'/api/dossiers/{self.dossier.id}/')
        self.assertEqual(resp.status_code, 200)
        logs = resp.data.get('maillogs', [])
        self.assertEqual(len(logs), 1)
        self.assertEqual(logs[0]['type'], str(mail_type.id))
        self.assertEqual(logs[0]['type_naam'], 'Statusupdate')


class DossierTypeCreateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.manager = _make_user('manager@test.com', module_permissions=['manage_dossiers'])
        self.regular = _make_user('user@test.com')

    def test_manager_can_create_type(self):
        self.client.force_authenticate(self.manager)
        resp = self.client.post('/api/dossiers/types/', {'naam': 'Nieuw type'}, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data['naam'], 'Nieuw type')

    def test_regular_user_cannot_create_type(self):
        self.client.force_authenticate(self.regular)
        resp = self.client.post('/api/dossiers/types/', {'naam': 'Verboden type'}, format='json')
        self.assertEqual(resp.status_code, 403)
