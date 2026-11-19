# Información educativa en el inicio

El bloque del inicio ahora muestra dos tarjetas informativas sobre tenencia responsable y Registro Nacional de Mascotas, con diseño adaptable y enlaces a ChileAtiende y al registro oficial. Funciona directamente con Live Server; no necesita Node.js ni un servicio de noticias.

Las imágenes compartidas se usaron como referencia de diseño. Las tarjetas están hechas en HTML y CSS con texto accesible. No reproducen cifras de registros de años anteriores ni se presentan como piezas oficiales del Gobierno.

Los archivos api/news.js, js/news.js y scripts/Servidor-Noticias.cjs pertenecen a la propuesta previa de noticias automáticas y ya no son necesarios para esta sección. El inicio no carga el cliente ni consulta la API.