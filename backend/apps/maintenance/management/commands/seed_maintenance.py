"""
Management command to seed maintenance categories, types, thresholds, and sample queries.
Vult de database met standaard onderhoudstypes voor transportbedrijven.
"""
from django.core.management.base import BaseCommand
from apps.maintenance.models import (
    MaintenanceCategory,
    MaintenanceType,
    MaintenanceThreshold,
    MaintenanceQuery,
    VehicleType,
)


class Command(BaseCommand):
    help = 'Seed standaard onderhoudscategorieën, types, thresholds en sample queries'

    def handle(self, *args, **options):
        self.stdout.write('Seeding onderhoud data...\n')
        self._seed_categories_and_types()
        self._seed_thresholds()
        self._seed_sample_queries()
        self.stdout.write(self.style.SUCCESS('Onderhoud data succesvol geseeded!'))

    def _seed_categories_and_types(self):
        categories_data = [
            {
                'name': 'Wettelijk verplicht',
                'name_en': 'Legally required',
                'description': 'Wettelijk verplichte keuringen en inspecties',
                'icon': 'ShieldCheckIcon',
                'color': '#EF4444',
                'sort_order': 1,
                'types': [
                    {'name': 'APK Keuring', 'name_en': 'MOT Test', 'is_mandatory': True,
                     'default_interval_days': 365, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 100, 'description': 'Jaarlijkse Algemene Periodieke Keuring'},
                    {'name': 'Tachograaf keuring', 'name_en': 'Tachograph inspection', 'is_mandatory': True,
                     'default_interval_days': 730, 'vehicle_type': VehicleType.TRUCK,
                     'estimated_cost': 250, 'description': 'Tweejaarlijkse tachograaf controle'},
                    {'name': 'ADR keuring', 'name_en': 'ADR inspection', 'is_mandatory': True,
                     'default_interval_days': 365, 'vehicle_type': VehicleType.TRUCK,
                     'estimated_cost': 350, 'description': 'Jaarlijkse ADR keuring voor gevaarlijke stoffen'},
                    {'name': 'Kraankeuring', 'name_en': 'Crane inspection', 'is_mandatory': True,
                     'default_interval_days': 365, 'vehicle_type': VehicleType.TRUCK,
                     'estimated_cost': 400, 'description': 'Keuring van hydraulische kraan/laadklep'},
                ]
            },
            {
                'name': 'Motor & Aandrijflijn',
                'name_en': 'Engine & Drivetrain',
                'description': 'Onderhoud aan motor, transmissie en aandrijving',
                'icon': 'CogIcon',
                'color': '#F59E0B',
                'sort_order': 2,
                'types': [
                    {'name': 'Motorolie verversen', 'name_en': 'Engine oil change',
                     'default_interval_km': 30000, 'default_interval_days': 180,
                     'vehicle_type': VehicleType.ALL, 'estimated_cost': 250,
                     'description': 'Olie en oliefilter vervangen'},
                    {'name': 'Transmissieolie verversen', 'name_en': 'Transmission oil change',
                     'default_interval_km': 100000, 'default_interval_days': 730,
                     'vehicle_type': VehicleType.ALL, 'estimated_cost': 400},
                    {'name': 'Koelvloeistof verversen', 'name_en': 'Coolant flush',
                     'default_interval_km': 150000, 'default_interval_days': 730,
                     'vehicle_type': VehicleType.ALL, 'estimated_cost': 150},
                    {'name': 'Distributieriem/-ketting', 'name_en': 'Timing belt/chain',
                     'default_interval_km': 200000, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 1200, 'description': 'Vervanging distributieriem of -ketting'},
                    {'name': 'Luchtfilter vervangen', 'name_en': 'Air filter replacement',
                     'default_interval_km': 50000, 'default_interval_days': 365,
                     'vehicle_type': VehicleType.ALL, 'estimated_cost': 80},
                    {'name': 'Brandstoffilter vervangen', 'name_en': 'Fuel filter replacement',
                     'default_interval_km': 60000, 'default_interval_days': 365,
                     'vehicle_type': VehicleType.ALL, 'estimated_cost': 120},
                    {'name': 'Turbo onderhoud', 'name_en': 'Turbo maintenance',
                     'default_interval_km': 200000, 'vehicle_type': VehicleType.TRUCK,
                     'estimated_cost': 2500},
                    {'name': 'AdBlue systeem', 'name_en': 'AdBlue system',
                     'default_interval_km': 100000, 'vehicle_type': VehicleType.TRUCK,
                     'estimated_cost': 500, 'description': 'SCR/AdBlue systeem onderhoud'},
                    {'name': 'EGR klep reinigen', 'name_en': 'EGR valve cleaning',
                     'default_interval_km': 80000, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 300},
                    {'name': 'Koppeling vervangen', 'name_en': 'Clutch replacement',
                     'default_interval_km': 300000, 'vehicle_type': VehicleType.TRUCK,
                     'estimated_cost': 3000},
                ]
            },
            {
                'name': 'Banden & Wielen',
                'name_en': 'Tires & Wheels',
                'description': 'Bandenwisseling, balancering, uitlijning',
                'icon': 'CircleStackIcon',
                'color': '#10B981',
                'sort_order': 3,
                'types': [
                    {'name': 'Banden vervangen', 'name_en': 'Tire replacement',
                     'default_interval_km': 100000, 'default_interval_days': 730,
                     'vehicle_type': VehicleType.ALL, 'estimated_cost': 800,
                     'description': 'Set banden vervangen'},
                    {'name': 'Banden wisselen (seizoen)', 'name_en': 'Seasonal tire swap',
                     'default_interval_days': 180, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 100, 'description': 'Zomer/winter banden wisselen'},
                    {'name': 'Wielbalancering', 'name_en': 'Wheel balancing',
                     'default_interval_km': 40000, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 80},
                    {'name': 'Wieluitlijning', 'name_en': 'Wheel alignment',
                     'default_interval_km': 50000, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 120},
                    {'name': 'Profieldiepte controle', 'name_en': 'Tread depth check',
                     'default_interval_days': 90, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 0, 'description': 'Visuele controle profieldiepte'},
                    {'name': 'Band coveren', 'name_en': 'Tire retreading',
                     'default_interval_km': 150000, 'vehicle_type': VehicleType.TRUCK,
                     'estimated_cost': 350, 'description': 'Banden laten coveren'},
                ]
            },
            {
                'name': 'Remmen',
                'name_en': 'Brakes',
                'description': 'Remblokken, remschijven, remvloeistof',
                'icon': 'StopIcon',
                'color': '#DC2626',
                'sort_order': 4,
                'types': [
                    {'name': 'Remblokken vervangen', 'name_en': 'Brake pad replacement',
                     'default_interval_km': 80000, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 500},
                    {'name': 'Remschijven vervangen', 'name_en': 'Brake disc replacement',
                     'default_interval_km': 120000, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 800},
                    {'name': 'Remvloeistof verversen', 'name_en': 'Brake fluid flush',
                     'default_interval_days': 730, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 100},
                    {'name': 'Remtrommels vervangen', 'name_en': 'Brake drum replacement',
                     'default_interval_km': 150000, 'vehicle_type': VehicleType.TRUCK,
                     'estimated_cost': 600},
                    {'name': 'Remleidingen controleren', 'name_en': 'Brake line inspection',
                     'default_interval_days': 365, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 50},
                    {'name': 'ABS systeem onderhoud', 'name_en': 'ABS system maintenance',
                     'default_interval_km': 100000, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 300},
                ]
            },
            {
                'name': 'Elektra & Verlichting',
                'name_en': 'Electrical & Lighting',
                'description': 'Accu, verlichting, elektrische systemen',
                'icon': 'BoltIcon',
                'color': '#8B5CF6',
                'sort_order': 5,
                'types': [
                    {'name': 'Accu vervangen', 'name_en': 'Battery replacement',
                     'default_interval_days': 1095, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 200},
                    {'name': 'Verlichting controle', 'name_en': 'Light inspection',
                     'default_interval_days': 90, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 30},
                    {'name': 'Dynamo/Alternator', 'name_en': 'Alternator',
                     'default_interval_km': 250000, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 500},
                    {'name': 'Startmotor', 'name_en': 'Starter motor',
                     'default_interval_km': 250000, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 450},
                ]
            },
            {
                'name': 'Carrosserie & Opbouw',
                'name_en': 'Body & Superstructure',
                'description': 'Carrosserie, opbouw, zeil, laadklep',
                'icon': 'CubeIcon',
                'color': '#6366F1',
                'sort_order': 6,
                'types': [
                    {'name': 'Carrosserie reparatie', 'name_en': 'Body repair',
                     'vehicle_type': VehicleType.ALL, 'estimated_cost': 1500},
                    {'name': 'Zeil/huif reparatie', 'name_en': 'Tarpaulin repair',
                     'vehicle_type': VehicleType.TRUCK, 'estimated_cost': 800},
                    {'name': 'Laadklep onderhoud', 'name_en': 'Tail lift maintenance',
                     'default_interval_days': 365, 'vehicle_type': VehicleType.TRUCK,
                     'estimated_cost': 300},
                    {'name': 'Koelinstallatie onderhoud', 'name_en': 'Refrigeration maintenance',
                     'default_interval_days': 365, 'vehicle_type': VehicleType.TRUCK,
                     'estimated_cost': 500},
                    {'name': 'Lak/spuitwerk', 'name_en': 'Paint job',
                     'vehicle_type': VehicleType.ALL, 'estimated_cost': 2000},
                ]
            },
            {
                'name': 'Chassis & Ophanging',
                'name_en': 'Chassis & Suspension',
                'description': 'Vering, dempers, chassis',
                'icon': 'WrenchScrewdriverIcon',
                'color': '#0EA5E9',
                'sort_order': 7,
                'types': [
                    {'name': 'Schokdempers vervangen', 'name_en': 'Shock absorber replacement',
                     'default_interval_km': 150000, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 600},
                    {'name': 'Luchtvering onderhoud', 'name_en': 'Air suspension maintenance',
                     'default_interval_km': 200000, 'vehicle_type': VehicleType.TRUCK,
                     'estimated_cost': 800},
                    {'name': 'Bladveren vervangen', 'name_en': 'Leaf spring replacement',
                     'default_interval_km': 300000, 'vehicle_type': VehicleType.TRUCK,
                     'estimated_cost': 1000},
                    {'name': 'Kogellgewrichten', 'name_en': 'Ball joints',
                     'default_interval_km': 150000, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 400},
                    {'name': 'Stuurinrichting', 'name_en': 'Steering system',
                     'default_interval_km': 200000, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 700},
                ]
            },
            {
                'name': 'Vloeistoffen & Smeermiddelen',
                'name_en': 'Fluids & Lubricants',
                'description': 'Alle vloeistoffen en smeerpunten',
                'icon': 'BeakerIcon',
                'color': '#14B8A6',
                'sort_order': 8,
                'types': [
                    {'name': 'Stuurbekrachtigingsvloeistof', 'name_en': 'Power steering fluid',
                     'default_interval_km': 100000, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 80},
                    {'name': 'Ruitensproeiervloeistof', 'name_en': 'Washer fluid',
                     'default_interval_days': 30, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 10},
                    {'name': 'Smeerpunten afsmeren', 'name_en': 'Grease points',
                     'default_interval_km': 30000, 'default_interval_days': 180,
                     'vehicle_type': VehicleType.TRUCK, 'estimated_cost': 50},
                    {'name': 'AdBlue bijvullen', 'name_en': 'AdBlue refill',
                     'default_interval_km': 10000, 'vehicle_type': VehicleType.TRUCK,
                     'estimated_cost': 30},
                ]
            },
            {
                'name': 'Trailer/Oplegger',
                'name_en': 'Trailer',
                'description': 'Specifiek onderhoud voor trailers en opleggers',
                'icon': 'RectangleStackIcon',
                'color': '#F97316',
                'sort_order': 9,
                'types': [
                    {'name': 'Schotelkoppeling onderhoud', 'name_en': 'Fifth wheel maintenance',
                     'default_interval_days': 180, 'vehicle_type': VehicleType.TRAILER,
                     'estimated_cost': 150},
                    {'name': 'Steunpoten onderhoud', 'name_en': 'Landing gear maintenance',
                     'default_interval_days': 365, 'vehicle_type': VehicleType.TRAILER,
                     'estimated_cost': 200},
                    {'name': 'Trailer remmen', 'name_en': 'Trailer brakes',
                     'default_interval_km': 80000, 'vehicle_type': VehicleType.TRAILER,
                     'estimated_cost': 400},
                    {'name': 'Trailer verlichting', 'name_en': 'Trailer lighting',
                     'default_interval_days': 90, 'vehicle_type': VehicleType.TRAILER,
                     'estimated_cost': 100},
                    {'name': 'Container-locks/twistlocks', 'name_en': 'Container locks',
                     'default_interval_days': 365, 'vehicle_type': VehicleType.TRAILER,
                     'estimated_cost': 80},
                ]
            },
            {
                'name': 'Overig',
                'name_en': 'Other',
                'description': 'Overig onderhoud en reparaties',
                'icon': 'EllipsisHorizontalIcon',
                'color': '#6B7280',
                'sort_order': 10,
                'types': [
                    {'name': 'Grote beurt', 'name_en': 'Major service',
                     'default_interval_km': 60000, 'default_interval_days': 365,
                     'vehicle_type': VehicleType.ALL, 'estimated_cost': 500},
                    {'name': 'Kleine beurt', 'name_en': 'Minor service',
                     'default_interval_km': 30000, 'default_interval_days': 180,
                     'vehicle_type': VehicleType.ALL, 'estimated_cost': 200},
                    {'name': 'Airco onderhoud', 'name_en': 'AC maintenance',
                     'default_interval_days': 365, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 150},
                    {'name': 'Ruitenwissers vervangen', 'name_en': 'Wiper replacement',
                     'default_interval_days': 365, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 30},
                    {'name': 'Interieur reiniging', 'name_en': 'Interior cleaning',
                     'default_interval_days': 90, 'vehicle_type': VehicleType.ALL,
                     'estimated_cost': 50},
                    {'name': 'Pechhulp/sleepdienst', 'name_en': 'Breakdown/Tow',
                     'vehicle_type': VehicleType.ALL, 'estimated_cost': 300,
                     'description': 'Ongepland: pech onderweg'},
                ]
            },
        ]

        for cat_data in categories_data:
            types_data = cat_data.pop('types')
            cat, created = MaintenanceCategory.objects.update_or_create(
                name=cat_data['name'],
                defaults=cat_data
            )
            action = 'aangemaakt' if created else 'bijgewerkt'
            self.stdout.write(f'  Categorie {action}: {cat.name}')

            for type_data in types_data:
                type_data['category'] = cat
                mt, created = MaintenanceType.objects.update_or_create(
                    name=type_data['name'],
                    category=cat,
                    defaults=type_data
                )
                action = 'aangemaakt' if created else 'bijgewerkt'
                self.stdout.write(f'    Type {action}: {mt.name}')

    def _seed_thresholds(self):
        """Maak standaard thresholds aan."""
        thresholds_data = [
            {
                'name': 'APK Verloopt',
                'description': 'Waarschuwing als APK binnenkort verloopt',
                'is_apk_threshold': True,
                'warning_days': 60,
                'critical_days': 30,
                'urgent_days': 14,
                'send_email': True,
                'send_push': True,
            },
            {
                'name': 'Gepland Onderhoud',
                'description': 'Waarschuwing voor gepland onderhoud',
                'is_apk_threshold': False,
                'warning_days': 30,
                'critical_days': 14,
                'urgent_days': 7,
                'send_email': True,
                'send_push': True,
            },
        ]

        for threshold_data in thresholds_data:
            threshold, created = MaintenanceThreshold.objects.update_or_create(
                name=threshold_data['name'],
                defaults=threshold_data
            )
            action = 'aangemaakt' if created else 'bijgewerkt'
            self.stdout.write(f'  Threshold {action}: {threshold.name}')

    def _seed_sample_queries(self):
        """Maak sample queries aan voor het dashboard."""
        sample_queries = [
            {
                'name': 'Top 10 duurste voertuigen (dit jaar)',
                'description': 'Welke voertuigen hebben het meeste gekost aan onderhoud dit jaar?',
                'query_definition': {
                    'model': 'MaintenanceTask',
                    'filters': {
                        'status': 'completed',
                        'completed_date__year': 2026,
                    },
                    'group_by': ['vehicle__kenteken', 'vehicle__type_wagen'],
                    'aggregations': [
                        {'name': 'total_cost', 'function': 'sum', 'field': 'total_cost'},
                        {'name': 'task_count', 'function': 'count', 'field': 'id'},
                    ],
                    'order_by': ['-total_cost'],
                    'limit': 10,
                },
                'result_type': 'chart_bar',
            },
            {
                'name': 'Onderhoud per categorie',
                'description': 'Verdeling van onderhoudskosten per categorie',
                'query_definition': {
                    'model': 'MaintenanceTask',
                    'filters': {
                        'status': 'completed',
                    },
                    'group_by': ['maintenance_type__category__name'],
                    'aggregations': [
                        {'name': 'total_cost', 'function': 'sum', 'field': 'total_cost'},
                        {'name': 'task_count', 'function': 'count', 'field': 'id'},
                    ],
                    'order_by': ['-total_cost'],
                    'limit': 20,
                },
                'result_type': 'chart_pie',
            },
            {
                'name': 'Achterstallig onderhoud',
                'description': 'Alle taken die over de deadline zijn',
                'query_definition': {
                    'model': 'MaintenanceTask',
                    'filters': {
                        'status__in': ['scheduled', 'in_progress'],
                        'scheduled_date__lt': '2026-02-26',
                    },
                    'group_by': [],
                    'aggregations': [],
                    'order_by': ['scheduled_date'],
                    'limit': 50,
                },
                'result_type': 'table',
            },
            {
                'name': 'Maandelijkse kosten trend',
                'description': 'Kostenontwikkeling per maand',
                'query_definition': {
                    'model': 'MaintenanceTask',
                    'filters': {
                        'status': 'completed',
                    },
                    'group_by': ['completed_date__month', 'completed_date__year'],
                    'aggregations': [
                        {'name': 'total_cost', 'function': 'sum', 'field': 'total_cost'},
                        {'name': 'task_count', 'function': 'count', 'field': 'id'},
                    ],
                    'order_by': ['completed_date__year', 'completed_date__month'],
                    'limit': 24,
                },
                'result_type': 'chart_line',
            },
            {
                'name': 'APK Status Overzicht',
                'description': 'Huidige APK status van alle voertuigen',
                'query_definition': {
                    'model': 'APKRecord',
                    'filters': {
                        'is_current': True,
                    },
                    'group_by': [],
                    'aggregations': [],
                    'order_by': ['expiry_date'],
                    'limit': 100,
                },
                'result_type': 'table',
            },
            {
                'name': 'Actieve waarschuwingen',
                'description': 'Alle niet-opgeloste onderhoudswaarschuwingen',
                'query_definition': {
                    'model': 'MaintenanceAlert',
                    'filters': {
                        'is_resolved': False,
                        'is_dismissed': False,
                    },
                    'group_by': [],
                    'aggregations': [],
                    'order_by': ['-created_at'],
                    'limit': 50,
                },
                'result_type': 'table',
            },
            {
                'name': 'Gemiddelde kosten per voertuigtype',
                'description': 'Wat kosten verschillende typen voertuigen gemiddeld?',
                'query_definition': {
                    'model': 'MaintenanceTask',
                    'filters': {
                        'status': 'completed',
                    },
                    'group_by': ['vehicle__type_wagen'],
                    'aggregations': [
                        {'name': 'avg_cost', 'function': 'avg', 'field': 'total_cost'},
                        {'name': 'total_cost', 'function': 'sum', 'field': 'total_cost'},
                        {'name': 'task_count', 'function': 'count', 'field': 'id'},
                    ],
                    'order_by': ['-total_cost'],
                    'limit': 10,
                },
                'result_type': 'chart_bar',
            },
        ]

        for query_data in sample_queries:
            query, created = MaintenanceQuery.objects.update_or_create(
                name=query_data['name'],
                is_sample=True,
                defaults={**query_data, 'is_sample': True, 'is_public': True}
            )
            action = 'aangemaakt' if created else 'bijgewerkt'
            self.stdout.write(f'  Sample query {action}: {query.name}')
