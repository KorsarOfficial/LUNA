// Конфигурация API
const API_URL = 'http://localhost:5000/api';

// Типы объектов инфраструктуры
const OBJECT_TYPES = {
    RESIDENTIAL: 'residential',
    SPORTS: 'sports',
    ADMINISTRATIVE: 'administrative',
    MEDICAL: 'medical',
    RESEARCH: 'research',
    REPAIR: 'repair',
    SPACEPORT: 'spaceport',
    COMMUNICATION: 'communication',
    PLANTATION: 'plantation',
    WASTE: 'waste',
    PRODUCTION: 'production',
    ASTRONOMY: 'astronomy',
    SOLAR: 'solar',
    MINING: 'mining'
};

// Критерии размещения объектов
const PLACEMENT_CRITERIA = {
    [OBJECT_TYPES.RESIDENTIAL]: {
        minDistance: 1000, // метры от опасных объектов
        maxSlope: 5, // градусы наклона поверхности
        radiationProtection: true,
        nearCommunication: true
    },
    [OBJECT_TYPES.SPACEPORT]: {
        minDistance: 5000, // метры от жилых зон
        maxSlope: 2,
        clearArea: true,
        nearCommunication: true
    }
    // Другие критерии будут добавлены позже
};

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
});

// Установка обработчиков событий
function initializeEventListeners() {
    document.getElementById('uploadTerrainBtn').addEventListener('click', handleTerrainUpload);
    document.getElementById('addObjectBtn').addEventListener('click', handleAddObject);
    document.getElementById('analyzeBtn').addEventListener('click', handleAnalyze);
    document.getElementById('exportBtn').addEventListener('click', handleExport);
    
    // Добавляем поддержку drag and drop для импорта
    const dropZone = document.getElementById('mapCanvas');
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.add('drag-over');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });
    
    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropZone.classList.remove('drag-over');
        
        const file = e.dataTransfer.files[0];
        if (!file) return;
        
        try {
            if (file.type === 'application/json') {
                // Импорт JSON
                const reader = new FileReader();
                reader.onload = (e) => {
                    const data = JSON.parse(e.target.result);
                    if (data.terrain) {
                        lunarMap.setTerrain(data.terrain);
                    }
                    if (data.objects) {
                        data.objects.forEach(obj => lunarMap.addObject(obj));
                    }
                    showNotification('План базы успешно импортирован', 'success');
                };
                reader.readAsText(file);
            } else if (file.type.startsWith('image/')) {
                // Импорт изображения рельефа
                handleTerrainUpload(file);
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Ошибка при импорте файла', 'error');
        }
    });
}

// Обработчики событий
async function handleTerrainUpload() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.tif,.jpg,.jpeg,.png';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            // Показываем индикатор загрузки
            const loadingIndicator = document.createElement('div');
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.textContent = 'Загрузка рельефа...';
            document.body.appendChild(loadingIndicator);

            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${API_URL}/terrain`, {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                throw new Error(data.message || 'Ошибка загрузки рельефа');
            }

            // Обновляем карту
            lunarMap.setTerrain(data.data);
            
            // Показываем сообщение об успехе
            showNotification('Рельеф успешно загружен', 'success');

        } catch (error) {
            console.error('Error:', error);
            showNotification('Ошибка при загрузке рельефа: ' + error.message, 'error');
        } finally {
            // Удаляем индикатор загрузки
            const loadingIndicator = document.querySelector('.loading-indicator');
            if (loadingIndicator) {
                loadingIndicator.remove();
            }
        }
    };

    input.click();
}

function handleAddObject() {
    const objectParams = document.querySelector('.object-params');
    objectParams.style.display = 'block';
    
    // Создание формы для параметров объекта
    const form = document.getElementById('objectForm');
    form.innerHTML = `
        <div class="form-group">
            <label for="objectType">Тип объекта:</label>
            <select name="type" id="objectType" required>
                ${Object.entries(OBJECT_TYPES).map(([key, value]) => 
                    `<option value="${value}">${key}</option>`
                ).join('')}
            </select>
        </div>
        <div class="form-group">
            <label for="objectSize">Размер (м²):</label>
            <input type="number" id="objectSize" name="size" min="1" max="1000" value="100" required>
        </div>
        <div class="form-buttons">
            <button type="submit" class="primary">Разместить</button>
            <button type="button" class="secondary" onclick="lunarMap.cancelObjectPlacement()">Отмена</button>
        </div>
    `;

    form.onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        
        // Начинаем размещение объекта
        lunarMap.startObjectPlacement(
            formData.get('type'),
            Number(formData.get('size'))
        );
        
        // Показываем инструкцию
        showNotification('Кликните на карте для размещения объекта', 'info');
    };
}

function handleAnalyze() {
    // TODO: Реализовать анализ участка
}

function handleExport() {
    const exportData = {
        terrain: lunarMap.terrain,
        objects: Array.from(lunarMap.objects.values()),
        metadata: {
            date: new Date().toISOString(),
            version: '1.0',
            scale: lunarMap.scale,
            offset: lunarMap.offset
        }
    };

    // Создаем превью карты
    const previewCanvas = document.createElement('canvas');
    previewCanvas.width = lunarMap.canvas.width;
    previewCanvas.height = lunarMap.canvas.height;
    const previewCtx = previewCanvas.getContext('2d');
    
    // Копируем текущее состояние карты
    previewCtx.drawImage(lunarMap.canvas, 0, 0);
    
    // Создаем диалог экспорта
    const dialog = document.createElement('div');
    dialog.className = 'export-dialog';
    dialog.innerHTML = `
        <div class="export-content">
            <h3>Экспорт плана базы</h3>
            <div class="preview-container">
                <img src="${previewCanvas.toDataURL()}" alt="Preview">
            </div>
            <div class="export-options">
                <label>
                    <input type="checkbox" id="includeMetadata" checked>
                    Включить метаданные
                </label>
                <label>
                    <input type="checkbox" id="includeTerrain" checked>
                    Включить данные о рельефе
                </label>
                <label>
                    <input type="checkbox" id="includeObjects" checked>
                    Включить объекты
                </label>
            </div>
            <div class="export-buttons">
                <button id="exportJSON">Экспорт JSON</button>
                <button id="exportImage">Экспорт изображения</button>
                <button id="cancelExport">Отмена</button>
            </div>
        </div>
    `;

    // Добавляем стили для диалога
    const styles = document.createElement('style');
    styles.textContent = `
        .export-dialog {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        }

        .export-content {
            background: var(--surface-color);
            padding: 20px;
            border-radius: 10px;
            max-width: 600px;
            width: 90%;
        }

        .preview-container {
            margin: 20px 0;
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 5px;
            overflow: hidden;
        }

        .preview-container img {
            width: 100%;
            height: auto;
        }

        .export-options {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin: 20px 0;
        }

        .export-buttons {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
    `;
    document.head.appendChild(styles);

    // Добавляем диалог в DOM
    document.body.appendChild(dialog);

    // Обработчики событий
    dialog.querySelector('#exportJSON').addEventListener('click', () => {
        const includeMetadata = dialog.querySelector('#includeMetadata').checked;
        const includeTerrain = dialog.querySelector('#includeTerrain').checked;
        const includeObjects = dialog.querySelector('#includeObjects').checked;

        const exportObj = {
            ...(includeMetadata && { metadata: exportData.metadata }),
            ...(includeTerrain && { terrain: exportData.terrain }),
            ...(includeObjects && { objects: exportData.objects })
        };

        const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lunar-base-plan-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        dialog.remove();
    });

    dialog.querySelector('#exportImage').addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = previewCanvas.toDataURL('image/png');
        a.download = `lunar-base-plan-${new Date().toISOString().split('T')[0]}.png`;
        a.click();
        dialog.remove();
    });

    dialog.querySelector('#cancelExport').addEventListener('click', () => {
        dialog.remove();
    });
}

// Вспомогательные функции
function updateMap(data) {
    // TODO: Обновление карты с новыми данными
}

function getCurrentMapPosition() {
    // TODO: Получение текущей позиции на карте
    return { x: 0, y: 0 };
}

function addObjectToList(object) {
    const list = document.getElementById('objectsList');
    const item = document.createElement('li');
    item.textContent = `${object.type} (${object.size}м²)`;
    item.dataset.id = object.id;
    item.onclick = () => showObjectInfo(object);
    list.appendChild(item);
}

function showObjectInfo(object) {
    const infoPanel = document.getElementById('objectInfo');
    infoPanel.style.display = 'block';
    infoPanel.innerHTML = `
        <h4>${object.type}</h4>
        <p>Размер: ${object.size}м²</p>
        <p>Координаты: (${object.position.x}, ${object.position.y})</p>
    `;
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Удаляем уведомление через 3 секунды
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Добавляем стили для уведомлений и индикатора загрузки
const styles = document.createElement('style');
styles.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        border-radius: 5px;
        color: white;
        z-index: 1000;
        animation: slideIn 0.3s ease-out;
    }

    .notification.success {
        background-color: #4CAF50;
    }

    .notification.error {
        background-color: #f44336;
    }

    .notification.info {
        background-color: #2196F3;
    }

    .loading-indicator {
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        padding: 20px;
        background: rgba(0, 0, 0, 0.8);
        color: white;
        border-radius: 5px;
        z-index: 1000;
    }

    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(styles);

// Добавляем стили для формы
const formStyles = document.createElement('style');
formStyles.textContent = `
    .form-group {
        margin-bottom: 15px;
    }

    .form-group label {
        display: block;
        margin-bottom: 5px;
        color: var(--text-color);
    }

    .form-group select,
    .form-group input {
        width: 100%;
        padding: 8px;
        border: 1px solid rgba(255, 255, 255, 0.2);
        border-radius: 4px;
        background: rgba(255, 255, 255, 0.1);
        color: var(--text-color);
    }

    .form-buttons {
        display: flex;
        gap: 10px;
        justify-content: flex-end;
        margin-top: 20px;
    }

    .form-buttons button {
        padding: 8px 16px;
        border: none;
        border-radius: 4px;
        cursor: pointer;
    }

    .form-buttons button.primary {
        background: var(--primary-color);
        color: white;
    }

    .form-buttons button.secondary {
        background: rgba(255, 255, 255, 0.1);
        color: var(--text-color);
    }

    .drag-over {
        border: 2px dashed var(--primary-color) !important;
    }
`;
document.head.appendChild(formStyles); 