from rest_framework import serializers
from .models import Spreadsheet, SpreadsheetTemplate


class SpreadsheetTemplateListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for template list view."""
    class Meta:
        model = SpreadsheetTemplate
        fields = [
            'id', 'naam', 'beschrijving', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SpreadsheetTemplateDetailSerializer(serializers.ModelSerializer):
    """Full serializer for template create/edit."""
    class Meta:
        model = SpreadsheetTemplate
        fields = [
            'id', 'naam', 'beschrijving',
            'kolommen', 'footer', 'standaard_tarieven', 'styling',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    ALLOWED_KOLOM_TYPES = {'tekst', 'nummer', 'decimaal', 'valuta', 'datum', 'tijd', 'berekend'}
    ALLOWED_LETTERTYPE = {'normal', 'bold', 'italic'}
    MAX_KOLOMMEN = 50
    MAX_FORMULA_LEN = 500
    MAX_KOLOM_NAAM_LEN = 100

    def validate_kolommen(self, value):
        """Valideer kolommen structuur en formule-veiligheid."""
        if not isinstance(value, list):
            raise serializers.ValidationError("Kolommen moet een lijst zijn.")
        if len(value) > self.MAX_KOLOMMEN:
            raise serializers.ValidationError(
                f"Maximaal {self.MAX_KOLOMMEN} kolommen toegestaan."
            )

        seen_ids = set()
        for i, kolom in enumerate(value):
            if not isinstance(kolom, dict):
                raise serializers.ValidationError(
                    f"Kolom {i} moet een object zijn."
                )

            # Verplichte velden
            kolom_id = kolom.get('id', '')
            if not kolom_id or not isinstance(kolom_id, str):
                raise serializers.ValidationError(
                    f"Kolom {i}: 'id' is verplicht en moet een string zijn."
                )
            if len(kolom_id) > 50:
                raise serializers.ValidationError(
                    f"Kolom {i}: 'id' mag maximaal 50 tekens zijn."
                )
            # Alleen alfanumeriek en underscores
            if not all(c.isalnum() or c == '_' for c in kolom_id):
                raise serializers.ValidationError(
                    f"Kolom {i}: 'id' mag alleen letters, cijfers en underscores bevatten."
                )
            if kolom_id in seen_ids:
                raise serializers.ValidationError(
                    f"Kolom {i}: 'id' '{kolom_id}' is al in gebruik."
                )
            seen_ids.add(kolom_id)

            naam = kolom.get('naam', '')
            if not naam or not isinstance(naam, str):
                raise serializers.ValidationError(
                    f"Kolom {i}: 'naam' is verplicht en moet een string zijn."
                )
            if len(naam) > self.MAX_KOLOM_NAAM_LEN:
                raise serializers.ValidationError(
                    f"Kolom {i}: 'naam' mag maximaal {self.MAX_KOLOM_NAAM_LEN} tekens zijn."
                )

            kolom_type = kolom.get('type', '')
            if kolom_type not in self.ALLOWED_KOLOM_TYPES:
                raise serializers.ValidationError(
                    f"Kolom {i}: ongeldige type '{kolom_type}'. "
                    f"Toegestaan: {', '.join(sorted(self.ALLOWED_KOLOM_TYPES))}"
                )

            # Formule validatie
            formule = kolom.get('formule', '')
            if formule:
                if not isinstance(formule, str):
                    raise serializers.ValidationError(
                        f"Kolom {i}: 'formule' moet een string zijn."
                    )
                if len(formule) > self.MAX_FORMULA_LEN:
                    raise serializers.ValidationError(
                        f"Kolom {i}: formule mag maximaal {self.MAX_FORMULA_LEN} tekens zijn."
                    )
                # Blokkeer gevaarlijke patronen (geen JS/Python execution)
                dangerous = ['import', 'require', 'eval', 'exec', 'fetch',
                             'document', 'window', 'process', '__proto__',
                             'constructor', 'prototype']
                formule_lower = formule.lower()
                for d in dangerous:
                    if d in formule_lower:
                        raise serializers.ValidationError(
                            f"Kolom {i}: formule bevat een niet-toegestaan woord: '{d}'."
                        )

            # Styling validatie
            styling = kolom.get('styling')
            if styling and isinstance(styling, dict):
                tekst_kleur = styling.get('tekstKleur', '')
                if tekst_kleur and not isinstance(tekst_kleur, str):
                    raise serializers.ValidationError(
                        f"Kolom {i}: styling.tekstKleur moet een string zijn."
                    )
                if tekst_kleur and len(tekst_kleur) > 20:
                    raise serializers.ValidationError(
                        f"Kolom {i}: styling.tekstKleur is te lang."
                    )
                lettertype = styling.get('lettertype', 'normal')
                if lettertype not in self.ALLOWED_LETTERTYPE:
                    raise serializers.ValidationError(
                        f"Kolom {i}: ongeldige lettertype '{lettertype}'."
                    )

            # Breedte validatie
            breedte = kolom.get('breedte', 100)
            if not isinstance(breedte, (int, float)) or breedte < 20 or breedte > 1000:
                raise serializers.ValidationError(
                    f"Kolom {i}: 'breedte' moet tussen 20 en 1000 zijn."
                )

        return value

    def validate_styling(self, value):
        """Valideer globale styling."""
        if not isinstance(value, dict):
            raise serializers.ValidationError("Styling moet een object zijn.")
        # Limit keys to known styling properties
        allowed_keys = {
            'header_achtergrond', 'header_tekst_kleur', 'header_lettertype',
            'rij_even_achtergrond', 'rij_oneven_achtergrond',
        }
        for key in value:
            if key not in allowed_keys:
                raise serializers.ValidationError(
                    f"Onbekende styling eigenschap: '{key}'."
                )
            if not isinstance(value[key], str) or len(value[key]) > 30:
                raise serializers.ValidationError(
                    f"Styling '{key}' moet een string zijn (max 30 tekens)."
                )
        return value


class SpreadsheetListSerializer(serializers.ModelSerializer):
    """Serializer for list view (lightweight)."""
    bedrijf_naam = serializers.CharField(source='bedrijf.naam', read_only=True)
    template_naam = serializers.CharField(source='template.naam', read_only=True, default=None)
    created_by_naam = serializers.SerializerMethodField()

    class Meta:
        model = Spreadsheet
        fields = [
            'id', 'naam', 'bedrijf', 'bedrijf_naam',
            'week_nummer', 'jaar',
            'tarief_per_uur', 'tarief_per_km', 'tarief_dot',
            'rijen', 'totaal_factuur', 'status',
            'template', 'template_naam',
            'created_by', 'created_by_naam',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'totaal_factuur', 'created_by', 'created_at', 'updated_at']

    def get_created_by_naam(self, obj):
        if obj.created_by:
            return f"{obj.created_by.voornaam} {obj.created_by.achternaam}".strip() or obj.created_by.username
        return None


class SpreadsheetDetailSerializer(serializers.ModelSerializer):
    """Serializer for detail/create/update view (includes rijen)."""
    bedrijf_naam = serializers.CharField(source='bedrijf.naam', read_only=True)
    template_naam = serializers.CharField(source='template.naam', read_only=True, default=None)
    created_by_naam = serializers.SerializerMethodField()

    class Meta:
        model = Spreadsheet
        fields = [
            'id', 'naam', 'bedrijf', 'bedrijf_naam',
            'week_nummer', 'jaar',
            'tarief_per_uur', 'tarief_per_km', 'tarief_dot',
            'rijen', 'notities', 'totaal_factuur', 'status',
            'template', 'template_naam',
            'created_by', 'created_by_naam',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'totaal_factuur', 'created_by', 'created_at', 'updated_at']

    def get_created_by_naam(self, obj):
        if obj.created_by:
            return f"{obj.created_by.voornaam} {obj.created_by.achternaam}".strip() or obj.created_by.username
        return None

    def validate_rijen(self, value):
        """Valideer dat rijen een lijst van dictionaries is."""
        if not isinstance(value, list):
            raise serializers.ValidationError("Rijen moet een lijst zijn.")
        for i, rij in enumerate(value):
            if not isinstance(rij, dict):
                raise serializers.ValidationError(f"Rij {i} moet een object zijn.")
        return value
