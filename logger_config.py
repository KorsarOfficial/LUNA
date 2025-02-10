import logging
import logging.handlers
import os
from datetime import datetime

# Создаем директорию для логов, если она не существует
if not os.path.exists('logs'):
    os.makedirs('logs')

# Настройка основного логгера
def setup_logger(name, log_file, level=logging.INFO):
    formatter = logging.Formatter(
        fmt='%(asctime)s - %(levelname)s - [%(name)s] - %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # Обработчик для файла
    file_handler = logging.handlers.RotatingFileHandler(
        log_file,
        maxBytes=10485760,  # 10MB
        backupCount=5,
        encoding='utf-8'
    )
    file_handler.setFormatter(formatter)

    # Обработчик для консоли
    console_handler = logging.StreamHandler()
    console_handler.setFormatter(formatter)

    # Настройка логгера
    logger = logging.getLogger(name)
    logger.setLevel(level)
    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger

# Создаем различные логгеры для разных компонентов
def create_loggers():
    logs = {
        'main': setup_logger('main', 'logs/main.log'),
        'api': setup_logger('api', 'logs/api.log'),
        'terrain': setup_logger('terrain', 'logs/terrain.log'),
        'objects': setup_logger('objects', 'logs/objects.log'),
        'validation': setup_logger('validation', 'logs/validation.log'),
        'spectrum': setup_logger('spectrum', 'logs/spectrum.log'),
        'error': setup_logger('error', 'logs/error.log', level=logging.ERROR)
    }
    return logs

# Функция для логирования запросов к API
def log_request(logger, request, include_body=False):
    log_data = {
        'method': request.method,
        'url': request.url,
        'headers': dict(request.headers),
        'remote_addr': request.remote_addr,
    }
    
    if include_body and request.is_json:
        log_data['body'] = request.get_json()
    
    logger.info(f"Request: {log_data}")

# Функция для логирования ответов API
def log_response(logger, response, include_body=False):
    """Логирование ответов API"""
    # Если response это кортеж (response, status_code)
    if isinstance(response, tuple):
        response_obj, status_code = response
    else:
        response_obj = response
        status_code = response.status_code

    log_data = {
        'status': status_code,
        'headers': dict(response_obj.headers) if hasattr(response_obj, 'headers') else {}
    }
    
    if include_body:
        try:
            if hasattr(response_obj, 'get_json'):
                log_data['body'] = response_obj.get_json()
            elif isinstance(response_obj, dict):
                log_data['body'] = response_obj
            else:
                log_data['body'] = 'Non-JSON response'
        except:
            log_data['body'] = 'Non-JSON response'
    
    logger.info(f"Response: {log_data}")

# Функция для логирования ошибок
def log_error(error_logger, error, context=None):
    error_data = {
        'error_type': type(error).__name__,
        'error_message': str(error),
        'context': context
    }
    error_logger.error(f"Error occurred: {error_data}", exc_info=True)

# Декоратор для логирования времени выполнения функций
def log_execution_time(logger):
    def decorator(func):
        def wrapper(*args, **kwargs):
            start_time = datetime.now()
            try:
                result = func(*args, **kwargs)
                execution_time = datetime.now() - start_time
                logger.info(f"Function {func.__name__} executed in {execution_time}")
                return result
            except Exception as e:
                execution_time = datetime.now() - start_time
                logger.error(f"Function {func.__name__} failed after {execution_time}", exc_info=True)
                raise
        return wrapper
    return decorator 