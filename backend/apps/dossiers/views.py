"""Views voor dossiers."""
import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser

from .models import DossierType, Dossier, DossierReactie, DossierBijlage
from .serializers import (
    DossierTypeSerializer,
    DossierListSerializer,
    DossierDetailSerializer,
    DossierCreateSerializer,
    DossierReactieSerializer,
    DossierBijlageSerializer,
)

logger = logging.getLogger(__name__)

PAGE_SIZE = 15


def _is_dossier_manager(user):
    """True for admin or users with manage_dossiers permission."""
    return user.is_admin or user.has_module_permission('manage_dossiers')


class DossierTypeViewSet(viewsets.ModelViewSet):
    """CRUD voor dossiertypen (alleen beheerders)."""
    serializer_class = DossierTypeSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return DossierType.objects.all()

    def _check_manager(self, request):
        if not _is_dossier_manager(request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Geen toegang.")

    def list(self, request, *args, **kwargs):
        if not _is_dossier_manager(request.user):
            qs = DossierType.objects.filter(actief=True)
            return Response(DossierTypeSerializer(qs, many=True).data)
        return super().list(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        self._check_manager(request)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        self._check_manager(request)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._check_manager(request)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._check_manager(request)
        instance = self.get_object()
        if instance.dossiers.exists():
            instance.actief = False
            instance.save()
            return Response({'detail': 'Type is in gebruik en wordt gedeactiveerd.'}, status=status.HTTP_200_OK)
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class DossierViewSet(viewsets.ModelViewSet):
    """CRUD voor dossiers."""
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get_queryset(self):
        user = self.request.user
        if _is_dossier_manager(user):
            qs = Dossier.objects.select_related(
                'type', 'instuurder', 'betreft_user', 'betreft_chauffeur'
            ).prefetch_related('bijlagen', 'reacties')
        elif user.is_chauffeur:
            qs = Dossier.objects.select_related(
                'type', 'instuurder', 'betreft_user', 'betreft_chauffeur'
            ).prefetch_related('bijlagen', 'reacties').filter(betreft_chauffeur=user)
        else:
            qs = Dossier.objects.none()

        type_id = self.request.query_params.get('type')
        if type_id:
            qs = qs.filter(type_id=type_id)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(onderwerp__icontains=search)

        return qs

    def get_serializer_class(self):
        if self.action == 'list':
            return DossierListSerializer
        if self.action == 'create':
            return DossierCreateSerializer
        return DossierDetailSerializer

    def _check_manager(self, request):
        if not _is_dossier_manager(request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("Geen toegang.")

    def list(self, request, *args, **kwargs):
        qs = self.get_queryset()
        try:
            page = max(1, int(request.query_params.get('page', 1)))
        except (ValueError, TypeError):
            page = 1
        start = (page - 1) * PAGE_SIZE
        end = start + PAGE_SIZE
        total = qs.count()
        items = qs[start:end]
        serializer = DossierListSerializer(items, many=True, context={'request': request})
        return Response({
            'count': total,
            'page': page,
            'page_size': PAGE_SIZE,
            'total_pages': max(1, (total + PAGE_SIZE - 1) // PAGE_SIZE),
            'results': serializer.data,
        })

    def create(self, request, *args, **kwargs):
        self._check_manager(request)
        serializer = DossierCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        dossier = serializer.save(instuurder=request.user)

        files = request.FILES.getlist('bijlagen')
        for f in files:
            DossierBijlage.objects.create(
                dossier=dossier,
                bestand=f,
                bestandsnaam=f.name,
                mimetype=f.content_type or '',
                grootte=f.size,
                geupload_door=request.user,
            )

        return Response(DossierDetailSerializer(dossier, context={'request': request}).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = DossierDetailSerializer(instance, context={'request': request})
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        self._check_manager(request)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._check_manager(request)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._check_manager(request)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['post', 'get'], url_path='reacties', parser_classes=[MultiPartParser, FormParser, JSONParser])
    def reacties(self, request, pk=None):
        if request.method == 'GET':
            return self._list_reacties(request, pk)
        return self._add_reactie(request, pk)

    def _list_reacties(self, request, pk=None):
        dossier = self.get_object()
        qs = dossier.reacties.all()
        if not _is_dossier_manager(request.user):
            qs = qs.filter(intern=False)
        return Response(DossierReactieSerializer(qs, many=True, context={'request': request}).data)

    def _add_reactie(self, request, pk=None):
        dossier = self.get_object()
        tekst = request.data.get('tekst', '').strip()
        if not tekst:
            return Response({'tekst': 'Dit veld is verplicht.'}, status=status.HTTP_400_BAD_REQUEST)

        intern = False
        if _is_dossier_manager(request.user):
            intern = str(request.data.get('intern', 'false')).lower() in ('true', '1', 'yes')

        reactie = DossierReactie.objects.create(
            dossier=dossier,
            auteur=request.user,
            tekst=tekst,
            intern=intern,
        )

        files = request.FILES.getlist('bijlagen')
        for f in files:
            DossierBijlage.objects.create(
                reactie=reactie,
                bestand=f,
                bestandsnaam=f.name,
                mimetype=f.content_type or '',
                grootte=f.size,
                geupload_door=request.user,
            )

        return Response(DossierReactieSerializer(reactie, context={'request': request}).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='bijlagen', parser_classes=[MultiPartParser, FormParser])
    def upload_bijlage(self, request, pk=None):
        self._check_manager(request)
        dossier = self.get_object()
        files = request.FILES.getlist('bijlagen')
        if not files:
            return Response({'error': 'Geen bestand(en) meegestuurd.'}, status=status.HTTP_400_BAD_REQUEST)
        created = []
        for f in files:
            bijlage = DossierBijlage.objects.create(
                dossier=dossier,
                bestand=f,
                bestandsnaam=f.name,
                mimetype=f.content_type or '',
                grootte=f.size,
                geupload_door=request.user,
            )
            created.append(bijlage)
        return Response(DossierBijlageSerializer(created, many=True, context={'request': request}).data, status=status.HTTP_201_CREATED)
