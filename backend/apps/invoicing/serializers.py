from rest_framework import serializers
from .models import InvoiceTemplate, Invoice, InvoiceLine


class InvoiceTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceTemplate
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']


class InvoiceLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceLine
        fields = '__all__'
        read_only_fields = ['id', 'totaal', 'created_at', 'updated_at']


class InvoiceSerializer(serializers.ModelSerializer):
    lines = InvoiceLineSerializer(many=True, read_only=True)
    bedrijf_naam = serializers.CharField(source='bedrijf.naam', read_only=True)
    template_naam = serializers.CharField(source='template.naam', read_only=True)
    created_by_naam = serializers.CharField(source='created_by.full_name', read_only=True)
    
    class Meta:
        model = Invoice
        fields = '__all__'
        read_only_fields = ['id', 'subtotaal', 'btw_bedrag', 'totaal', 'pdf_file', 'sent_at', 'created_at', 'updated_at']


class InvoiceCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Invoice
        fields = ['template', 'bedrijf', 'type', 'factuurdatum', 'vervaldatum', 'btw_percentage', 'opmerkingen']
