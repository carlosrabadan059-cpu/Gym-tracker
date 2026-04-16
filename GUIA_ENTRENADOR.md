# Guía del Entrenador - GymTracker

Bienvenido a la **Guía del Entrenador** de GymTracker. Este documento detalla todas las funcionalidades a las que tienes acceso como entrenador dentro de la plataforma para gestionar a tus clientes, asignar rutinas y mantener el catálogo de ejercicios.

---

## 1. Acceso al Panel de Entrenador

Para poder acceder al entorno de entrenador, tu cuenta debe tener asignado el rol `trainer` o `admin` en la base de datos (tabla `profiles`).
Al iniciar sesión, si el sistema detecta tus permisos, accederás directamente al **Dashboard de Entrenador**, tu centro de control principal.

---

## 2. Dashboard de Entrenador

En el menú principal encontrarás las dos áreas clave de tu gestión:

1. **Clientes:** Accede a la lista de todos tus clientes, sus métricas, y sus entrenamientos.
2. **Librería:** Gestiona el catálogo global de ejercicios de la plataforma.

---

## 3. Gestión de Clientes

En la sección **Clientes** verás a todos los usuarios de la plataforma que no sean entrenadores. Al pulsar sobre cualquier cliente, accederás a su **Perfil de Cliente**.

### 3.1 Progreso e Historial
En el perfil del cliente verás rápidamente dos estadísticas vitales:
- **Sesiones:** Muestra cuántos entrenamientos ha completado en sus últimos 20 registros.
- **Rutinas:** El número de rutinas personalizadas que tiene actualmente asignadas.

Puedes pulsar sobre cualquier sesión en el historial del cliente para abrir el **Panel de Detalles de la Sesión**, donde revisarás exactamente:
- Qué ejercicios hizo.
- Las series completadas, el peso movido y las repeticiones ejecutadas.
- El tiempo invertido y las calorías estimadas.

### 3.2 Administración de Rutinas Asignadas
Desde el perfil del cliente verás las rutinas que tiene asignadas. Con cada rutina puedes:
- **Desplegar:** Ver los ejercicios, series y repeticiones.
- **Editar Ejercicios:** Cambiar al instante el número de series o repeticiones de un ejercicio directamente con los selectores de (`-` y `+`).
- **Añadir Ejercicios:** Agregar nuevos ejercicios a una rutina ya asignada mediante un buscador intuitivo.
- **Renombrar/Desasignar:** Cambiar el nombre de la rutina si es necesario, o eliminar la asignación por completo pulsando en el icono de papelera.

---

## 4. Asignación y Creación de Rutinas

Si pulsas en **Asignar** dentro del perfil de un cliente, entrarás a la herramienta de asignación de rutinas, la cual tiene dos modalidades:

### Modo 1: Rutinas Existentes
Ideal para ahorrar tiempo.
- Podrás ver un listado de bloques de rutinas ya creadas y estructuradas.
- Al seleccionar una, puedes inspeccionarla.
- Pulsando en "Asignar", esa rutina se transferirá instantáneamente a tu cliente, quien recibirá una notificación avisándole que tiene nuevo trabajo por hacer.
- También puedes renombrar o eliminar rutinas maestras desde esta vista.

### Modo 2: Crear Nueva (Personalizada)
Si el cliente requiere un plan específico:
1. Define un **Nombre** (ej: Día 1 - Pierna pesada).
2. Selecciona un **Color** identificativo para la tarjeta del usuario.
3. Busca ejercicios usando el buscador o navegando por los grupos musculares.
4. **Al seleccionar un ejercicio**, podrás definir en la misma tarjeta sus **Series** y **Reps**.
5. Al darle a Guardar, la rutina se construirá y asignará al cliente generando una notificación en tiempo real.

---

## 5. Librería de Ejercicios

La **Librería** (accesible desde el Dashboard) es el corazón del catálogo de GymTracker. Aquí puedes visualizar, buscar y editar todos los ejercicios organizados por grupo muscular.

### 5.1 Eliminar Ejercicios
Puedes activar el modo de edición (botón "Editar" arriba a la derecha) para poder eliminar fácilmente cualquier ejercicio obsoleto, confirmando la eliminación pulsando en el icono rojo.

### 5.2 Añadir Nuevos Ejercicios
Si te falta algún movimiento, pulsa en **Añadir**:
- Escribe el nombre del ejercicio.
- Selecciona el **Grupo muscular** (puedes crear categorías personalizadas seleccionando `+ Personalizado`).
- **Imagen:** Puedes vincular una imagen de apoyo visual desde la biblioteca de imágenes locales de la plataforma. Usa el buscador en la galería para encontrar rápidamente la máquina o postura adecuada (ej: buscas "pecho" o "biceps" y te aparecerán los dibujos integrados en el sistema).

Al guardar, estará instantáneamente disponible para ser usado en el creador de rutinas.
