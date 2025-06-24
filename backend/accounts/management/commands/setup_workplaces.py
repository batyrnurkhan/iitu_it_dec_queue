from django.core.management.base import BaseCommand
from accounts.models import WorkplaceType


class Command(BaseCommand):
    help = 'Setup workplaces with queue type permissions'

    def handle(self, *args, **options):
        workplaces_config = [
            # Столы 1-7: только Бакалавр грант
            *[{
                'name': f'Стол {i}',
                'workplace_type': 'TABLE',
                'number': i,
                'allowed_queue_types': ['BACHELOR_GRANT']
            } for i in range(1, 8)],

            # Столы 8-10: Бакалавр грант + Бакалавр платное
            *[{
                'name': f'Стол {i}',
                'workplace_type': 'TABLE',
                'number': i,
                'allowed_queue_types': ['BACHELOR_GRANT', 'BACHELOR_PAID']
            } for i in range(8, 11)],

            # Столы 11-12: Магистратура + PhD
            *[{
                'name': f'Стол {i}',
                'workplace_type': 'TABLE',
                'number': i,
                'allowed_queue_types': ['MASTER', 'PHD']
            } for i in range(11, 13)],

            # Кабинеты для Platonus
            {
                'name': 'Кабинет 305',
                'workplace_type': 'ROOM',
                'number': 305,
                'location': 'Третий этаж',
                'allowed_queue_types': ['PLATONUS']
            },
            {
                'name': 'Кабинет 306',
                'workplace_type': 'ROOM',
                'number': 306,
                'location': 'Третий этаж',
                'allowed_queue_types': ['PLATONUS']
            },
            {
                'name': 'Кабинет 307',
                'workplace_type': 'ROOM',
                'number': 307,
                'location': 'Третий этаж',
                'allowed_queue_types': ['PLATONUS']
            }
        ]

        for workplace_data in workplaces_config:
            workplace, created = WorkplaceType.objects.get_or_create(
                name=workplace_data['name'],
                defaults={
                    'workplace_type': workplace_data['workplace_type'],
                    'number': workplace_data['number'],
                    'location': workplace_data.get('location', ''),
                    'allowed_queue_types': workplace_data['allowed_queue_types'],
                    'is_active': True
                }
            )

            if created:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Создано рабочее место: {workplace.name} '
                        f'(может обслуживать: {", ".join(workplace.allowed_queue_types)})'
                    )
                )
            else:
                # Обновляем разрешения для существующих рабочих мест
                workplace.allowed_queue_types = workplace_data['allowed_queue_types']
                workplace.save()

                self.stdout.write(
                    self.style.WARNING(
                        f'Обновлено рабочее место: {workplace.name} '
                        f'(может обслуживать: {", ".join(workplace.allowed_queue_types)})'
                    )
                )

        self.stdout.write(
            self.style.SUCCESS('Все рабочие места настроены успешно!')
        )

        # Показываем сводку - используем Python вместо SQL для подсчета
        self.stdout.write('\n📊 Сводка по распределению:')

        all_workplaces = WorkplaceType.objects.all()

        # Подсчитываем в Python
        bachelor_grant_count = 0
        bachelor_paid_count = 0
        master_count = 0
        phd_count = 0
        platonus_count = 0

        for workplace in all_workplaces:
            if 'BACHELOR_GRANT' in workplace.allowed_queue_types:
                bachelor_grant_count += 1
            if 'BACHELOR_PAID' in workplace.allowed_queue_types:
                bachelor_paid_count += 1
            if 'MASTER' in workplace.allowed_queue_types:
                master_count += 1
            if 'PHD' in workplace.allowed_queue_types:
                phd_count += 1
            if 'PLATONUS' in workplace.allowed_queue_types:
                platonus_count += 1

        self.stdout.write(f'🎓 Бакалавр грант: {bachelor_grant_count} мест')
        self.stdout.write(f'💳 Бакалавр платное: {bachelor_paid_count} мест')
        self.stdout.write(f'📚 Магистратура: {master_count} мест')
        self.stdout.write(f'🔬 PhD: {phd_count} мест')
        self.stdout.write(f'💻 Platonus: {platonus_count} мест')

        # Показываем детали по каждому рабочему месту
        self.stdout.write('\n📋 Детали по рабочим местам:')

        tables = all_workplaces.filter(workplace_type='TABLE').order_by('number')
        rooms = all_workplaces.filter(workplace_type='ROOM').order_by('number')

        if tables:
            self.stdout.write('\n🪑 Столы:')
            for table in tables:
                queue_types_str = ', '.join(table.allowed_queue_types)
                self.stdout.write(f'  • {table.name}: {queue_types_str}')

        if rooms:
            self.stdout.write('\n🏢 Кабинеты:')
            for room in rooms:
                queue_types_str = ', '.join(room.allowed_queue_types)
                self.stdout.write(f'  • {room.name}: {queue_types_str}')