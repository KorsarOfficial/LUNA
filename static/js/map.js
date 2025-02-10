class LunarMap {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.terrain = null;
        this.objects = new Map();
        this.scale = 1;
        this.offset = { x: 0, y: 0 };
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };
        this.gridSize = 50;
        this.selectedObject = null;
        this.isPlacingObject = false;
        this.placementPreview = null;
        this.currentMapPosition = null;
        
        // Устанавливаем размер canvas
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.initializeEventListeners();
        
        // Начальная отрисовка сетки
        this.render();
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.render();
    }

    initializeEventListeners() {
        // Обработка перемещения карты
        this.canvas.addEventListener('mousedown', (e) => {
            if (this.isPlacingObject) {
                this.tryPlaceObject(e);
            } else {
                this.isDragging = true;
                this.lastMousePos = { x: e.clientX, y: e.clientY };
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const mapPos = this.screenToMap(
                e.clientX - this.canvas.offsetLeft,
                e.clientY - this.canvas.offsetTop
            );
            
            // Обновляем текущую позицию
            this.currentMapPosition = {
                x: Math.round(mapPos.x / this.gridSize) * this.gridSize,
                y: Math.round(mapPos.y / this.gridSize) * this.gridSize
            };

            if (this.isPlacingObject) {
                this.updatePlacementPreview(e);
            } else if (this.isDragging) {
                const deltaX = e.clientX - this.lastMousePos.x;
                const deltaY = e.clientY - this.lastMousePos.y;

                this.offset.x += deltaX / this.scale;
                this.offset.y += deltaY / this.scale;

                this.lastMousePos = { x: e.clientX, y: e.clientY };
                this.render();
            }

            // Обновляем информацию о координатах
            this.updateCoordinatesInfo(mapPos);
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.hideCoordinatesInfo();
        });

        // Обработка масштабирования
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            const mousePos = this.screenToMap(
                e.clientX - this.canvas.offsetLeft,
                e.clientY - this.canvas.offsetTop
            );

            this.scale *= delta;
            this.scale = Math.max(0.1, Math.min(this.scale, 10)); // Ограничиваем масштаб

            const newMousePos = this.screenToMap(
                e.clientX - this.canvas.offsetLeft,
                e.clientY - this.canvas.offsetTop
            );
            this.offset.x += (newMousePos.x - mousePos.x);
            this.offset.y += (newMousePos.y - mousePos.y);

            this.render();
        });
    }

    updateCoordinatesInfo(mapPos) {
        let coordsInfo = document.getElementById('coordsInfo');
        if (!coordsInfo) {
            coordsInfo = document.createElement('div');
            coordsInfo.id = 'coordsInfo';
            coordsInfo.className = 'coords-info';
            document.body.appendChild(coordsInfo);
        }

        const gridPos = {
            x: Math.round(mapPos.x / this.gridSize) * this.gridSize,
            y: Math.round(mapPos.y / this.gridSize) * this.gridSize
        };

        coordsInfo.textContent = `X: ${gridPos.x}, Y: ${gridPos.y}`;
        coordsInfo.style.display = 'block';
        
        // Позиционируем информацию рядом с курсором
        const canvasRect = this.canvas.getBoundingClientRect();
        coordsInfo.style.left = (canvasRect.left + event.clientX + 20) + 'px';
        coordsInfo.style.top = (canvasRect.top + event.clientY - 20) + 'px';
    }

    hideCoordinatesInfo() {
        const coordsInfo = document.getElementById('coordsInfo');
        if (coordsInfo) {
            coordsInfo.style.display = 'none';
        }
    }

    getCurrentMapPosition() {
        return this.currentMapPosition || { x: 0, y: 0 };
    }

    setTerrain(terrainData) {
        this.terrain = terrainData;
        // Центрируем карту при загрузке рельефа
        this.offset = {
            x: this.canvas.width / 2 / this.scale,
            y: this.canvas.height / 2 / this.scale
        };
        this.render();
    }

    addObject(object) {
        this.objects.set(object.id, object);
        this.render();
    }

    removeObject(objectId) {
        this.objects.delete(objectId);
        this.render();
    }

    startObjectPlacement(objectType, size) {
        this.isPlacingObject = true;
        this.placementPreview = { type: objectType, size: size };
        this.canvas.style.cursor = 'crosshair';
    }

    cancelObjectPlacement() {
        this.isPlacingObject = false;
        this.placementPreview = null;
        this.canvas.style.cursor = 'default';
        this.render();
    }

    async tryPlaceObject(e) {
        if (!this.placementPreview) return;

        const mapPos = this.screenToMap(e.clientX - this.canvas.offsetLeft, e.clientY - this.canvas.offsetTop);
        const position = {
            x: Math.round(mapPos.x / this.gridSize) * this.gridSize,
            y: Math.round(mapPos.y / this.gridSize) * this.gridSize
        };

        try {
            const response = await fetch(`${API_URL}/validate-placement`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    type: this.placementPreview.type,
                    size: this.placementPreview.size,
                    position: position
                })
            });

            const data = await response.json();
            
            if (data.success) {
                this.addObject({
                    id: Date.now(),
                    type: this.placementPreview.type,
                    size: this.placementPreview.size,
                    position: position
                });
                showNotification('Объект успешно размещен', 'success');
            } else {
                showNotification(data.message, 'error');
            }
        } catch (error) {
            console.error('Error:', error);
            showNotification('Ошибка при размещении объекта', 'error');
        }

        this.cancelObjectPlacement();
    }

    updatePlacementPreview(e) {
        if (!this.placementPreview) return;

        const mapPos = this.screenToMap(e.clientX - this.canvas.offsetLeft, e.clientY - this.canvas.offsetTop);
        this.placementPreview.position = {
            x: Math.round(mapPos.x / this.gridSize) * this.gridSize,
            y: Math.round(mapPos.y / this.gridSize) * this.gridSize
        };
        this.render();
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Рисуем сетку
        this.renderGrid();
        
        // Рисуем рельеф
        if (this.terrain) {
            this.renderTerrain();
        }

        // Рисуем объекты
        this.objects.forEach(object => {
            this.renderObject(object);
        });

        // Рисуем предпросмотр размещения
        if (this.isPlacingObject) {
            this.renderPlacementPreview();
        }
    }

    renderGrid() {
        const gridSize = this.gridSize * this.scale;
        const offsetX = (this.offset.x * this.scale) % gridSize;
        const offsetY = (this.offset.y * this.scale) % gridSize;
        
        // Вычисляем количество линий
        const numLinesX = Math.ceil(this.canvas.width / gridSize) + 1;
        const numLinesY = Math.ceil(this.canvas.height / gridSize) + 1;
        
        // Рисуем основную сетку
        this.ctx.strokeStyle = '#2a2a2a';
        this.ctx.lineWidth = 1;
        
        // Рисуем вертикальные линии
        for (let i = 0; i < numLinesX; i++) {
            const x = i * gridSize + offsetX;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        // Рисуем горизонтальные линии
        for (let i = 0; i < numLinesY; i++) {
            const y = i * gridSize + offsetY;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }

        // Рисуем координатные оси
        this.ctx.strokeStyle = '#4a4a4a';
        this.ctx.lineWidth = 2;
        
        // Ось X
        const yAxis = this.mapToScreen(0, 0).y;
        if (yAxis >= 0 && yAxis <= this.canvas.height) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, yAxis);
            this.ctx.lineTo(this.canvas.width, yAxis);
            this.ctx.stroke();
        }
        
        // Ось Y
        const xAxis = this.mapToScreen(0, 0).x;
        if (xAxis >= 0 && xAxis <= this.canvas.width) {
            this.ctx.beginPath();
            this.ctx.moveTo(xAxis, 0);
            this.ctx.lineTo(xAxis, this.canvas.height);
            this.ctx.stroke();
        }
    }

    renderTerrain() {
        if (!this.terrain || !this.terrain.height_map) return;

        const heightMap = this.terrain.height_map;
        const width = this.terrain.dimensions.width;
        const height = this.terrain.dimensions.height;
        
        // Создаем изображение из карты высот
        const imageData = this.ctx.createImageData(width, height);
        
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const heightValue = heightMap[y][x];
                const normalizedHeight = (heightValue - this.terrain.statistics.min_height) / 
                    (this.terrain.statistics.max_height - this.terrain.statistics.min_height);
                
                const index = (y * width + x) * 4;
                
                // Используем цветовую схему для высот
                const color = this.getHeightColor(normalizedHeight);
                
                imageData.data[index] = color.r;     // R
                imageData.data[index + 1] = color.g; // G
                imageData.data[index + 2] = color.b; // B
                imageData.data[index + 3] = 255;     // A
            }
        }
        
        // Масштабируем и отрисовываем карту высот
        const scaledWidth = width * this.scale;
        const scaledHeight = height * this.scale;
        
        // Создаем временный canvas для масштабирования
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);
        
        // Отрисовываем масштабированное изображение
        this.ctx.drawImage(tempCanvas, 
            this.offset.x, this.offset.y, 
            scaledWidth, scaledHeight);
            
        // Отрисовываем сетку поверх карты высот
        this.renderGrid();
    }

    getHeightColor(normalizedHeight) {
        // Цветовая схема для разных высот
        if (normalizedHeight < 0.2) {
            return { r: 0, g: 0, b: 139 }; // Темно-синий для низин
        } else if (normalizedHeight < 0.4) {
            return { r: 34, g: 139, b: 34 }; // Зеленый для равнин
        } else if (normalizedHeight < 0.6) {
            return { r: 205, g: 133, b: 63 }; // Коричневый для холмов
        } else if (normalizedHeight < 0.8) {
            return { r: 139, g: 137, b: 137 }; // Серый для гор
        } else {
            return { r: 255, g: 255, b: 255 }; // Белый для вершин
        }
    }

    renderObject(object) {
        const screenPos = this.mapToScreen(object.position.x, object.position.y);
        const size = object.size * this.scale;
        
        // Рисуем зону объекта
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = this.getObjectColor(object.type, 0.3);
        this.ctx.fill();
        
        // Рисуем границу объекта
        this.ctx.strokeStyle = this.getObjectColor(object.type);
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Рисуем иконку объекта
        this.ctx.fillStyle = this.getObjectColor(object.type);
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, 5, 0, Math.PI * 2);
        this.ctx.fill();
        
        // Добавляем подпись
        this.ctx.font = '12px Arial';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(object.type, screenPos.x, screenPos.y + size / 2 + 20);
    }

    renderPlacementPreview() {
        if (!this.placementPreview || !this.placementPreview.position) return;

        const screenPos = this.mapToScreen(
            this.placementPreview.position.x,
            this.placementPreview.position.y
        );
        const size = this.placementPreview.size * this.scale;

        // Рисуем зону предпросмотра
        this.ctx.beginPath();
        this.ctx.arc(screenPos.x, screenPos.y, size / 2, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.fill();
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.setLineDash([5, 5]);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Рисуем координаты
        this.ctx.font = '12px Arial';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(
            `(${this.placementPreview.position.x}, ${this.placementPreview.position.y})`,
            screenPos.x,
            screenPos.y - size / 2 - 10
        );
    }

    getObjectColor(type, opacity = 1) {
        const colors = {
            [OBJECT_TYPES.RESIDENTIAL]: '#4CAF50',
            [OBJECT_TYPES.SPACEPORT]: '#2196F3',
            [OBJECT_TYPES.MEDICAL]: '#F44336',
            // Добавить цвета для других типов объектов
            default: '#9E9E9E'
        };
        return `rgba(${colors[type] || colors.default}, ${opacity})`;
    }

    // Преобразование координат экрана в координаты карты
    screenToMap(screenX, screenY) {
        return {
            x: (screenX / this.scale) - this.offset.x,
            y: (screenY / this.scale) - this.offset.y
        };
    }

    // Преобразование координат карты в координаты экрана
    mapToScreen(mapX, mapY) {
        return {
            x: (mapX + this.offset.x) * this.scale,
            y: (mapY + this.offset.y) * this.scale
        };
    }
}

// Создание экземпляра карты
const lunarMap = new LunarMap('mapCanvas'); 