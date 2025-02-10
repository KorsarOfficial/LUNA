class LunarObject {
    constructor(type, size, position) {
        this.id = crypto.randomUUID();
        this.type = type;
        this.size = size;
        this.position = position;
        this.connections = new Set();
        this.resources = {
            power: 0,
            water: 0,
            oxygen: 0
        };
    }

    // Проверка возможности размещения объекта
    static validatePlacement(object, terrain, existingObjects) {
        const criteria = PLACEMENT_CRITERIA[object.type];
        if (!criteria) return { valid: true };

        const validations = [];

        // Проверка наклона поверхности
        if (criteria.maxSlope !== undefined) {
            const slope = terrain.getSlope(object.position.x, object.position.y);
            validations.push({
                valid: slope <= criteria.maxSlope,
                message: `Наклон поверхности (${slope}°) превышает допустимый (${criteria.maxSlope}°)`
            });
        }

        // Проверка минимального расстояния до других объектов
        if (criteria.minDistance !== undefined) {
            for (const existingObject of existingObjects) {
                const distance = this.calculateDistance(object.position, existingObject.position);
                validations.push({
                    valid: distance >= criteria.minDistance,
                    message: `Расстояние до объекта ${existingObject.type} (${distance}м) меньше минимального (${criteria.minDistance}м)`
                });
            }
        }

        // Проверка наличия средств связи поблизости
        if (criteria.nearCommunication) {
            const hasCommunication = existingObjects.some(obj => 
                obj.type === OBJECT_TYPES.COMMUNICATION &&
                this.calculateDistance(object.position, obj.position) <= 2000
            );
            validations.push({
                valid: hasCommunication,
                message: 'Отсутствует доступ к средствам связи в радиусе 2000м'
            });
        }

        // Проверка наличия свободного пространства
        if (criteria.clearArea) {
            const hasObstacles = existingObjects.some(obj =>
                this.calculateDistance(object.position, obj.position) <= 100
            );
            validations.push({
                valid: !hasObstacles,
                message: 'Недостаточно свободного пространства для размещения объекта'
            });
        }

        const failures = validations.filter(v => !v.valid);
        return {
            valid: failures.length === 0,
            messages: failures.map(f => f.message)
        };
    }

    // Расчет расстояния между двумя точками
    static calculateDistance(point1, point2) {
        const dx = point2.x - point1.x;
        const dy = point2.y - point1.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    // Добавление связи с другим объектом
    addConnection(object) {
        this.connections.add(object.id);
        object.connections.add(this.id);
    }

    // Удаление связи с объектом
    removeConnection(object) {
        this.connections.delete(object.id);
        object.connections.delete(this.id);
    }

    // Обновление ресурсов объекта
    updateResources(resources) {
        Object.assign(this.resources, resources);
    }

    // Получение информации об объекте
    getInfo() {
        return {
            id: this.id,
            type: this.type,
            size: this.size,
            position: this.position,
            connections: Array.from(this.connections),
            resources: { ...this.resources }
        };
    }
}

// Менеджер объектов лунной базы
class LunarBaseManager {
    constructor() {
        this.objects = new Map();
        this.terrain = null;
    }

    setTerrain(terrain) {
        this.terrain = terrain;
    }

    // Добавление нового объекта
    addObject(type, size, position) {
        const object = new LunarObject(type, size, position);
        
        // Проверка возможности размещения
        const validation = LunarObject.validatePlacement(
            object,
            this.terrain,
            Array.from(this.objects.values())
        );

        if (!validation.valid) {
            throw new Error(validation.messages.join('\n'));
        }

        this.objects.set(object.id, object);
        return object;
    }

    // Удаление объекта
    removeObject(objectId) {
        const object = this.objects.get(objectId);
        if (!object) return false;

        // Удаление всех связей
        Array.from(object.connections).forEach(connectedId => {
            const connectedObject = this.objects.get(connectedId);
            if (connectedObject) {
                object.removeConnection(connectedObject);
            }
        });

        return this.objects.delete(objectId);
    }

    // Получение объекта по ID
    getObject(objectId) {
        return this.objects.get(objectId);
    }

    // Получение всех объектов
    getAllObjects() {
        return Array.from(this.objects.values());
    }

    // Поиск объектов по типу
    getObjectsByType(type) {
        return Array.from(this.objects.values())
            .filter(obj => obj.type === type);
    }

    // Создание связи между объектами
    createConnection(object1Id, object2Id) {
        const object1 = this.objects.get(object1Id);
        const object2 = this.objects.get(object2Id);

        if (!object1 || !object2) {
            throw new Error('One or both objects not found');
        }

        object1.addConnection(object2);
    }

    // Экспорт данных о базе
    exportBase() {
        return {
            objects: Array.from(this.objects.values()).map(obj => obj.getInfo()),
            terrain: this.terrain ? {
                // Добавить экспорт данных о рельефе
            } : null
        };
    }

    // Импорт данных о базе
    importBase(data) {
        this.objects.clear();
        this.terrain = data.terrain;

        data.objects.forEach(objData => {
            const object = new LunarObject(
                objData.type,
                objData.size,
                objData.position
            );
            object.id = objData.id;
            object.connections = new Set(objData.connections);
            object.resources = { ...objData.resources };
            this.objects.set(object.id, object);
        });
    }
}

// Создание экземпляра менеджера базы
const lunarBaseManager = new LunarBaseManager(); 