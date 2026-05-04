"""Tests voor de dossiers module."""
from django.test import TestCase
from rest_framework.test import APIClient
from apps.accounts.models import User
from .models import DossierType, Dossier, DossierReactie


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
