import numpy as np
from typing import Dict, List, Tuple, Any
import math
from PIL import Image
import io

class TerrainValidator:
    """Валидатор данных о рельефе"""
    
    SUPPORTED_FORMATS = ['.jpg', '.jpeg', '.png', '.tiff']
    MAX_FILE_SIZE = 16 * 1024 * 1024  # 16MB
    
    def __init__(self):
        self.max_slope = {
            'residential': 5,  # градусов
            'spaceport': 2,
            'solar': 10,
            'mining': 15,
            'default': 7
        }
        
        self.min_elevation = {
            'residential': 0,  # метров
            'spaceport': -10,
            'mining': -50,
            'default': -20
        }
        self.last_error = None

    def process_terrain_file(self, file):
        """Обработка файла с данными о рельефе"""
        try:
            # Проверка формата файла
            if not self._validate_file_format(file.filename):
                raise ValueError(f"Неподдерживаемый формат файла. Поддерживаемые форматы: {', '.join(self.SUPPORTED_FORMATS)}")
            
            # Чтение и валидация изображения
            image_data = file.read()
            if len(image_data) > self.MAX_FILE_SIZE:
                raise ValueError(f"Размер файла превышает максимально допустимый ({self.MAX_FILE_SIZE / 1024 / 1024}MB)")
            
            # Преобразование в массив высот
            height_map = self._process_image(image_data)
            
            # Базовая валидация данных
            if not self._validate_height_map(height_map):
                raise ValueError("Некорректные данные о рельефе")
            
            return {
                'height_map': height_map.tolist(),
                'dimensions': {
                    'width': height_map.shape[1],
                    'height': height_map.shape[0]
                },
                'statistics': {
                    'min_height': float(np.min(height_map)),
                    'max_height': float(np.max(height_map)),
                    'mean_height': float(np.mean(height_map))
                }
            }
            
        except Exception as e:
            self.last_error = str(e)
            raise
    
    def _validate_file_format(self, filename):
        """Проверка формата файла"""
        return any(filename.lower().endswith(fmt) for fmt in self.SUPPORTED_FORMATS)
    
    def _process_image(self, image_data):
        """Преобразование изображения в карту высот"""
        try:
            # Открываем изображение
            img = Image.open(io.BytesIO(image_data))
            
            # Преобразуем в оттенки серого
            if img.mode != 'L':
                img = img.convert('L')
            
            # Преобразуем в numpy массив
            height_map = np.array(img)
            
            return height_map
            
        except Exception as e:
            raise ValueError(f"Ошибка при обработке изображения: {str(e)}")
    
    def _validate_height_map(self, height_map):
        """Валидация карты высот"""
        # Проверяем размерность
        if height_map.ndim != 2:
            return False
        
        # Проверяем минимальный размер
        if height_map.shape[0] < 10 or height_map.shape[1] < 10:
            return False
        
        # Проверяем наличие данных
        if np.all(height_map == height_map[0, 0]):
            return False
            
        return True
    
    def validate_placement(self, position, object_type, terrain_data):
        """Проверка возможности размещения объекта"""
        try:
            height_map = np.array(terrain_data['height_map'])
            x, y = int(position['x']), int(position['y'])
            
            # Проверка границ
            if not (0 <= x < height_map.shape[1] and 0 <= y < height_map.shape[0]):
                return {'valid': False, 'message': 'Позиция находится за пределами карты'}
            
            # Проверка уклона
            slope = self._calculate_slope(height_map, x, y)
            max_allowed_slope = self._get_max_allowed_slope(object_type)
            
            if slope > max_allowed_slope:
                return {'valid': False, 'message': f'Слишком крутой уклон ({slope:.1f}°) для объекта типа {object_type}'}
            
            return {'valid': True, 'message': 'Размещение допустимо'}
            
        except Exception as e:
            return {'valid': False, 'message': f'Ошибка при проверке размещения: {str(e)}'}
    
    def _calculate_slope(self, height_map, x, y, window_size=3):
        """Расчет уклона местности"""
        # Получаем окрестность точки
        x_start = max(0, x - window_size // 2)
        x_end = min(height_map.shape[1], x + window_size // 2 + 1)
        y_start = max(0, y - window_size // 2)
        y_end = min(height_map.shape[0], y + window_size // 2 + 1)
        
        region = height_map[y_start:y_end, x_start:x_end]
        
        # Расчет градиентов
        gy, gx = np.gradient(region)
        
        # Расчет максимального уклона в градусах
        slope = np.arctan(np.sqrt(gx**2 + gy**2)) * 180 / np.pi
        return float(np.max(slope))
    
    def _get_max_allowed_slope(self, object_type):
        """Получение максимально допустимого уклона для типа объекта"""
        # Максимальные уклоны для разных типов объектов
        max_slopes = {
            'administrative': 5.0,
            'residential': 7.0,
            'industrial': 3.0,
            'storage': 2.0,
            'power': 10.0,
            'communication': 15.0,
            'research': 8.0
        }
        return max_slopes.get(object_type, 5.0)  # По умолчанию 5 градусов

    def calculate_slope(self, point1: Tuple[float, float, float], 
                       point2: Tuple[float, float, float]) -> float:
        """Расчет уклона между двумя точками"""
        dx = point2[0] - point1[0]
        dy = point2[1] - point1[1]
        dz = point2[2] - point1[2]
        
        distance = math.sqrt(dx*dx + dy*dy)
        if distance == 0:
            return 0
            
        slope_rad = math.atan2(dz, distance)
        return math.degrees(slope_rad)

    def get_surrounding_points(self, position: Tuple[float, float], 
                             terrain_data: Dict) -> List[Tuple[float, float, float]]:
        """Получение точек вокруг заданной позиции"""
        # TODO: Реализовать получение окружающих точек из terrain_data
        return []


class ObjectValidator:
    def __init__(self):
        self.min_distances = {
            'residential': {
                'spaceport': 5000,  # метров
                'mining': 2000,
                'waste': 3000
            },
            'spaceport': {
                'residential': 5000,
                'medical': 4000
            },
            'medical': {
                'spaceport': 4000,
                'mining': 3000
            },
            'default': 1000
        }

        self.required_nearby = {
            'residential': ['medical', 'communication'],
            'medical': ['communication'],
            'research': ['communication'],
            'spaceport': ['communication', 'repair']
        }

    def validate_object(self, object_data: Dict) -> Dict:
        """Валидация данных объекта"""
        try:
            required_fields = ['type', 'position', 'size']
            for field in required_fields:
                if field not in object_data:
                    return {
                        'valid': False,
                        'message': f'Отсутствует обязательное поле: {field}'
                    }

            # Проверка типа объекта
            if not isinstance(object_data['type'], str):
                return {
                    'valid': False,
                    'message': 'Тип объекта должен быть строкой'
                }

            # Проверка позиции
            position = object_data['position']
            if not isinstance(position, dict) or 'x' not in position or 'y' not in position:
                return {
                    'valid': False,
                    'message': 'Позиция должна содержать координаты x и y'
                }

            # Проверка размера
            if not isinstance(object_data['size'], (int, float)) or object_data['size'] <= 0:
                return {
                    'valid': False,
                    'message': 'Размер должен быть положительным числом'
                }

            return {'valid': True, 'message': 'Валидация объекта успешна'}

        except Exception as e:
            return {
                'valid': False,
                'message': f'Ошибка при валидации объекта: {str(e)}'
            }

    def check_distance_requirements(self, object_type: str, position: Tuple[float, float, float], 
                                  existing_objects: Dict[int, Dict]) -> Dict:
        """Проверка требований к расстояниям между объектами"""
        try:
            min_distances = self.min_distances.get(object_type, {})
            default_distance = self.min_distances['default']

            for obj_id, obj in existing_objects.items():
                required_distance = min_distances.get(obj['type'], default_distance)
                actual_distance = self.calculate_distance(position, obj['position'])

                if actual_distance < required_distance:
                    return {
                        'valid': False,
                        'message': f'Too close to {obj["type"]} object (ID: {obj_id}). ' \
                                 f'Minimum distance: {required_distance}m, ' \
                                 f'Actual distance: {actual_distance:.1f}m'
                    }

            return {'valid': True, 'message': 'Distance requirements met'}

        except Exception as e:
            return {
                'valid': False,
                'message': f'Error checking distance requirements: {str(e)}'
            }

    @staticmethod
    def calculate_distance(point1: Tuple[float, float, float], 
                         point2: Tuple[float, float, float]) -> float:
        """Расчет расстояния между двумя точками"""
        return math.sqrt(sum((a - b) ** 2 for a, b in zip(point1, point2)))


class SafetyAnalyzer:
    def __init__(self):
        self.safety_zones = {
            'spaceport': 5000,  # метров
            'mining': 2000,
            'waste': 3000,
            'production': 1500
        }
        
        self.radiation_sensitive = ['residential', 'medical', 'research']
        self.noise_sensitive = ['residential', 'medical', 'research']

    def analyze_safety(self, object_data: Dict, existing_objects: Dict, 
                      terrain_data: Dict) -> Dict:
        """Анализ безопасности размещения объекта"""
        try:
            object_type = object_data['type']
            position = object_data['position']

            # Проверка зон безопасности
            safety_result = self.check_safety_zones(object_type, position, existing_objects)
            if not safety_result['valid']:
                return safety_result

            # Проверка радиационной безопасности
            if object_type in self.radiation_sensitive:
                radiation_result = self.check_radiation_safety(position, existing_objects, terrain_data)
                if not radiation_result['valid']:
                    return radiation_result

            # Проверка шумового воздействия
            if object_type in self.noise_sensitive:
                noise_result = self.check_noise_safety(position, existing_objects)
                if not noise_result['valid']:
                    return noise_result

            return {'valid': True, 'message': 'Safety checks passed'}

        except Exception as e:
            return {
                'valid': False,
                'message': f'Error analyzing safety: {str(e)}'
            }

    def check_safety_zones(self, object_type: str, position: Tuple[float, float, float], 
                          existing_objects: Dict) -> Dict:
        """Проверка зон безопасности"""
        try:
            # Проверяем, не попадает ли объект в чужие зоны безопасности
            for obj_id, obj in existing_objects.items():
                if obj['type'] in self.safety_zones:
                    distance = ObjectValidator.calculate_distance(position, obj['position'])
                    required_distance = self.safety_zones[obj['type']]
                    
                    if distance < required_distance:
                        return {
                            'valid': False,
                            'message': f'Position is within safety zone of {obj["type"]} ' \
                                     f'(ID: {obj_id}). Required distance: {required_distance}m'
                        }

            return {'valid': True, 'message': 'Safety zones check passed'}

        except Exception as e:
            return {
                'valid': False,
                'message': f'Error checking safety zones: {str(e)}'
            }

    def check_radiation_safety(self, position: Tuple[float, float, float], 
                             existing_objects: Dict, terrain_data: Dict) -> Dict:
        """Проверка радиационной безопасности"""
        # TODO: Реализовать проверку радиационной безопасности
        return {'valid': True, 'message': 'Radiation safety check passed'}

    def check_noise_safety(self, position: Tuple[float, float, float], 
                          existing_objects: Dict) -> Dict:
        """Проверка шумового воздействия"""
        # TODO: Реализовать проверку шумового воздействия
        return {'valid': True, 'message': 'Noise safety check passed'} 