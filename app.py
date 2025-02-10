from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import webbrowser
from threading import Timer
import time
from functools import wraps
from logger_config import create_loggers, log_request, log_response, log_error, log_execution_time
from validation import TerrainValidator, ObjectValidator, SafetyAnalyzer

# Инициализация логгеров
loggers = create_loggers()
main_logger = loggers['main']
api_logger = loggers['api']
terrain_logger = loggers['terrain']
objects_logger = loggers['objects']
validation_logger = loggers['validation']
spectrum_logger = loggers['spectrum']
error_logger = loggers['error']

app = Flask(__name__, static_url_path='')
CORS(app)

# Конфигурация
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # Максимальный размер файла 16MB

# Инициализация валидаторов
terrain_validator = TerrainValidator()
object_validator = ObjectValidator()
safety_analyzer = SafetyAnalyzer()

# Структуры данных для хранения информации о базе
lunar_objects = {}
terrain_data = {}

def open_browser():
    """Открывает браузер с приложением"""
    try:
        webbrowser.open('http://127.0.0.1:5000')
        main_logger.info("Browser opened at http://127.0.0.1:5000")
    except Exception as e:
        main_logger.error(f"Failed to open browser: {str(e)}")

def create_response(success, message, data=None, status=200):
    """Создает стандартизированный ответ API"""
    response = {
        'success': success,
        'message': message
    }
    if data is not None:
        response['data'] = data
    return jsonify(response), status

def log_api(logger):
    """Декоратор для логирования API"""
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            # Логируем входящий запрос
            log_request(logger, request, include_body=True)
            
            try:
                # Замеряем время выполнения
                start_time = time.perf_counter()
                
                # Выполняем функцию
                response = f(*args, **kwargs)
                
                # Логируем время выполнения
                execution_time = time.perf_counter() - start_time
                logger.info(f"Function {f.__name__} executed in {execution_time:.3f} seconds")
                
                # Логируем ответ
                log_response(logger, response, include_body=True)
                return response
            except Exception as e:
                # Логируем ошибку
                log_error(error_logger, e, {
                    'endpoint': request.endpoint,
                    'method': request.method,
                    'args': args,
                    'kwargs': kwargs
                })
                # Возвращаем ошибку клиенту
                return create_response(False, str(e), status=500)
        return wrapper
    return decorator

@app.route('/')
@log_api(main_logger)
def root():
    """Корневой маршрут"""
    try:
        main_logger.info("Serving index.html")
        return send_from_directory('static', 'index.html')
    except Exception as e:
        main_logger.error(f"Error serving index.html: {str(e)}")
        return create_response(False, "Failed to load application", status=500)

@app.route('/api/terrain', methods=['POST'])
@log_api(terrain_logger)
def upload_terrain():
    """Загрузка данных о рельефе"""
    if 'file' not in request.files:
        terrain_logger.warning("No file provided in terrain upload request")
        return create_response(False, 'No file provided', status=400)

    file = request.files['file']
    if not file.filename:
        terrain_logger.warning("Empty filename provided")
        return create_response(False, 'No file selected', status=400)

    terrain_logger.info(f"Processing terrain file: {file.filename}")
    
    try:
        # Обработка и валидация данных о рельефе
        global terrain_data
        terrain_data = terrain_validator.process_terrain_file(file)
        terrain_logger.info("Terrain data processed successfully")
        return create_response(True, 'Terrain data uploaded successfully', terrain_data)
    except Exception as e:
        terrain_logger.error(f"Error processing terrain data: {str(e)}", exc_info=True)
        return create_response(False, 'Failed to process terrain data', status=500)

@app.route('/api/objects', methods=['POST'])
@log_api(objects_logger)
def add_object():
    """Добавление нового объекта инфраструктуры"""
    try:
        data = request.json
        if not data:
            return create_response(False, 'No data provided', status=400)

        objects_logger.info(f"Adding new object: {data}")

        # Валидация объекта
        validation_result = object_validator.validate_object(data)
        if not validation_result['valid']:
            return create_response(False, validation_result['message'], status=400)

        # Проверка размещения
        if not terrain_data:
            return create_response(False, 'Terrain data not loaded', status=400)

        placement_result = terrain_validator.validate_placement(
            data['position'],
            data['type'],
            terrain_data
        )
        if not placement_result['valid']:
            return create_response(False, placement_result['message'], status=400)

        # Проверка безопасности
        safety_result = safety_analyzer.analyze_safety(
            data,
            lunar_objects,
            terrain_data
        )
        if not safety_result['valid']:
            return create_response(False, safety_result['message'], status=400)

        # Сохранение объекта
        object_id = len(lunar_objects) + 1
        lunar_objects[object_id] = data
        
        return create_response(True, 'Object added successfully', {'id': object_id})
    except Exception as e:
        objects_logger.error(f"Error adding object: {str(e)}", exc_info=True)
        return create_response(False, 'Failed to add object', status=500)

@app.route('/api/validate-placement', methods=['POST'])
@log_api(validation_logger)
def validate_placement():
    """Проверка возможности размещения объекта"""
    try:
        data = request.json
        if not data:
            return create_response(False, 'No data provided', status=400)

        validation_logger.info(f"Validating placement for: {data}")

        if not terrain_data:
            return create_response(False, 'Terrain data not loaded', status=400)

        # Комплексная проверка размещения
        validation_results = {
            'object': object_validator.validate_object(data),
            'terrain': terrain_validator.validate_placement(
                data['position'],
                data['type'],
                terrain_data
            ),
            'safety': safety_analyzer.analyze_safety(
                data,
                lunar_objects,
                terrain_data
            )
        }

        # Проверяем все результаты
        is_valid = all(result['valid'] for result in validation_results.values())
        messages = [result['message'] for result in validation_results.values() if not result['valid']]

        return create_response(
            is_valid,
            'Validation successful' if is_valid else '; '.join(messages),
            validation_results
        )
    except Exception as e:
        validation_logger.error(f"Error validating placement: {str(e)}", exc_info=True)
        return create_response(False, 'Failed to validate placement', status=500)

@app.route('/api/analyze-spectrum', methods=['POST'])
@log_api(spectrum_logger)
def analyze_spectrum():
    """Спектральный анализ участка поверхности"""
    if 'file' not in request.files:
        spectrum_logger.warning("No file provided in spectrum analysis request")
        return create_response(False, 'No file provided', status=400)

    file = request.files['file']
    if not file.filename:
        spectrum_logger.warning("Empty filename provided")
        return create_response(False, 'No file selected', status=400)

    spectrum_logger.info(f"Processing spectrum analysis for file: {file.filename}")
    
    try:
        # TODO: Добавить логику спектрального анализа
        spectrum_logger.info("Spectrum analysis completed successfully")
        return create_response(True, 'Analysis completed')
    except Exception as e:
        spectrum_logger.error(f"Error in spectrum analysis: {str(e)}", exc_info=True)
        return create_response(False, 'Failed to complete spectrum analysis', status=500)

@app.errorhandler(404)
def not_found_error(error):
    error_logger.warning(f"404 error: {request.url}")
    return create_response(False, 'Not found', status=404)

@app.errorhandler(500)
def internal_error(error):
    error_logger.error(f"500 error: {str(error)}", exc_info=True)
    return create_response(False, 'Internal server error', status=500)

if __name__ == '__main__':
    main_logger.info("Starting LUNA application")
    Timer(1, open_browser).start()
    try:
        app.run(debug=True)
    except Exception as e:
        error_logger.critical(f"Failed to start application: {str(e)}", exc_info=True)
        raise 