"""Serializers voor dossiers."""
from rest_framework import serializers
from .models import DossierType, Dossier, DossierReactie, DossierBijlage


class DossierTypeSerializer(serializers.ModelSerializer):
    in_gebruik = serializers.SerializerMethodField()

    class Meta:
        model = DossierType
        fields = ['id', 'naam', 'actief', 'in_gebruik', 'created_at']
        read_only_fields = ['id', 'created_at']

    def get_in_gebruik(self, obj):
        return obj.dossiers.exists()


class DossierBijlageSerializer(serializers.ModelSerializer):
    bestand_url = serializers.SerializerMethodField()

    class Meta:
        model = DossierBijlage
        fields = ['id', 'bestandsnaam', 'mimetype', 'grootte', 'uploaded_at', 'bestand_url']
        read_only_fields = ['id', 'uploaded_at', 'bestand_url']

    def get_bestand_url(self, obj):
        request = self.context.get('request')
        if obj.bestand and request:
            return request.build_absolute_uri(obj.bestand.url)
        return None


class DossierReactieSerializer(serializers.ModelSerializer):
    auteur_naam = serializers.SerializerMethodField()
    bijlagen = DossierBijlageSerializer(many=True, read_only=True)

    class Meta:
        model = DossierReactie
        fields = ['id', 'dossier', 'auteur', 'auteur_naam', 'tekst', 'intern', 'created_at', 'bijlagen']
        read_only_fields = ['id', 'dossier', 'auteur', 'created_at']

    def get_auteur_naam(self, obj):
        if obj.auteur:
            return obj.auteur.full_name or obj.auteur.email
        return None


class DossierListSerializer(serializers.ModelSerializer):
    type_naam = serializers.CharField(source='type.naam', read_only=True)
    instuurder_naam = serializers.SerializerMethodField()
    betreft_naam = serializers.SerializerMethodField()
    heeft_bijlage = serializers.SerializerMethodField()
    reactie_count = serializers.SerializerMethodField()

    class Meta:
        model = Dossier
        fields = [
            'id', 'onderwerp', 'type', 'type_naam',
            'instuurder', 'instuurder_naam',
            'betreft_user', 'betreft_chauffeur', 'betreft_naam',
            'heeft_bijlage', 'reactie_count', 'created_at', 'updated_at',
        ]

    def get_instuurder_naam(self, obj):
        if obj.instuurder:
            return obj.instuurder.full_name or obj.instuurder.email
        return None

    def get_betreft_naam(self, obj):
        person = obj.betreft
        if person:
            return person.full_name or person.email
        return None

    def get_heeft_bijlage(self, obj):
        if obj.bijlagen.exists():
            return True
        return DossierBijlage.objects.filter(reactie__dossier=obj).exists()

    def get_reactie_count(self, obj):
        user = self.context.get('request').user if self.context.get('request') else None
        qs = obj.reacties.all()
        if user and not user.is_admin and not user.has_module_permission('manage_dossiers'):
            qs = qs.filter(intern=False)
        return qs.count()


class DossierDetailSerializer(serializers.ModelSerializer):
    type_naam = serializers.CharField(source='type.naam', read_only=True)
    instuurder_naam = serializers.SerializerMethodField()
    betreft_naam = serializers.SerializerMethodField()
    bijlagen = DossierBijlageSerializer(many=True, read_only=True)
    reacties = serializers.SerializerMethodField()

    class Meta:
        model = Dossier
        fields = [
            'id', 'onderwerp', 'inhoud', 'type', 'type_naam',
            'instuurder', 'instuurder_naam',
            'betreft_user', 'betreft_chauffeur', 'betreft_naam',
            'bijlagen', 'reacties', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'instuurder', 'created_at', 'updated_at']

    def get_instuurder_naam(self, obj):
        if obj.instuurder:
            return obj.instuurder.full_name or obj.instuurder.email
        return None

    def get_betreft_naam(self, obj):
        person = obj.betreft
        if person:
            return person.full_name or person.email
        return None

    def get_reacties(self, obj):
        user = self.context.get('request').user if self.context.get('request') else None
        qs = obj.reacties.all()
        if user and not user.is_admin and not user.has_module_permission('manage_dossiers'):
            qs = qs.filter(intern=False)
        return DossierReactieSerializer(qs, many=True, context=self.context).data


class DossierCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Dossier
        fields = ['id', 'onderwerp', 'inhoud', 'type', 'betreft_user', 'betreft_chauffeur', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate(self, data):
        betreft_user = data.get('betreft_user')
        betreft_chauffeur = data.get('betreft_chauffeur')
        if not betreft_user and not betreft_chauffeur:
            raise serializers.ValidationError("Geef 'betreft_user' of 'betreft_chauffeur' op.")
        if betreft_user and betreft_chauffeur:
            raise serializers.ValidationError("Vul slechts één van 'betreft_user' of 'betreft_chauffeur' in.")
        return data
