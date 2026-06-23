# MB Systems - Estudio de mercado y practicas a adaptar

## Objetivo

Este sistema no necesita competir como ecommerce publico. Tiene que funcionar como una herramienta semi-privada para clientes: clara, confiable, rapida y facil de usar para pedir equipos sin depender de idas y vueltas por WhatsApp.

La oportunidad principal es combinar lo mejor de tres mundos:

- Catalogo tecnico de rental profesional.
- Paquetes simples para clientes no tecnicos.
- Flujo de solicitud/cotizacion con disponibilidad real y confirmacion operativa.

## Sitios revisados

- FOH Productions: https://fohproductions.net/equipment-catalog/
- OM Rental en Alquiler de Camaras: https://www.alquilerdecamaras.com.ar/rentals/omrental/
- MR Sonido: https://mrsonido.com.ar/alquiler
- Sonido Palermo: https://sonidopalermo.com.ar/
- Soundtec: https://www.soundtec.com.ar/m_servicios_rental_eventos.html
- Bay AV Rentals: https://www.bayavrental.com/
- Nvision360 Productions: https://nvision360.com/shop/
- Main Light: https://www.mainlight.com/
- ONGA Artful Light: https://onga.ca/catalog
- PRG Gear: https://prggear.com/product-category/lighting-rental/

## Patrones fuertes del mercado

### 1. Venden confianza antes que precio

Los mejores sitios no solo muestran equipos. Repiten ideas como mantenimiento, soporte tecnico, inventario probado, armado, instalacion, operadores, reemplazos urgentes y asesoramiento.

Para MB Systems:

- Mostrar un bloque corto de confianza arriba del catalogo: "Stock actualizado", "Equipos revisados", "Retiro coordinado", "Soporte por WhatsApp".
- En la reserva, aclarar que la disponibilidad se bloquea al confirmar.
- En admin, mantener checklist de retiro/devolucion porque esto tambien sostiene la promesa comercial.

### 2. Los clientes simples compran paquetes, los tecnicos eligen items

OM Rental muestra "paquetes listos" para fiestas/eventos sencillos y despues un catalogo. Esto es clave: mucha gente no sabe si necesita subwoofer, consola, microfono o tripodes.

Para MB Systems:

- Agregar una seccion "Paquetes sugeridos" antes del catalogo:
  - Sonido chico: 1 parlante + tripode + cableado.
  - Sonido pro: 2 parlantes + consola + microfono.
  - Sonido + luces basico.
  - Fiesta pro: 2 parlantes + sub + cabezales + humo.
- Cada paquete debe tener "Ideal para", "Incluye" y precio estimado.
- El usuario debe poder sumar el paquete y luego ajustar items sueltos.

### 3. El flujo habitual es cotizacion/pedido, no checkout puro

Nvision360, Main Light, PRG y ONGA usan "Add to Quote", "Request Quote" o revision por equipo humano. En rental real hay logistica, disponibilidad, deposito, entrega, instalacion y compatibilidad tecnica.

Para MB Systems:

- El CTA publico deberia decir "Solicitar reserva" o "Pedir cotizacion", no "Comprar".
- Pagos pueden existir despues, pero no deberian dominar el MVP.
- La pantalla final debe decir: "Solicitud recibida. Te confirmamos por WhatsApp cuando el equipo quede bloqueado."

### 4. El catalogo profesional tiene filtros tecnicos, pero no debe abrumar

PRG Gear usa filtros muy tecnicos por categoria, marca, tipo, potencia, lente, etc. Sirve para profesionales, pero seria demasiado para clientes +40 o eventos chicos.

Para MB Systems:

- Mantener filtros simples: Todos, Sonido, Iluminacion, Efectos, Estructuras, Energia.
- Agregar busqueda fuerte por nombre, categoria, tags y uso: "fiesta", "microfono", "bajos", "humo".
- En cada tarjeta, usar 3 chips maximos visibles. Mas detalle en un drawer/modal.

### 5. Las tarjetas deben resolver dudas practicas

Las mejores fichas dicen precio, disponibilidad, categoria, cantidad, especificaciones y accion clara. Los sitios menos utiles se quedan en textos generales.

Para MB Systems:

- Mantener foto real, categoria, disponibilidad y precio por dia.
- Agregar un boton secundario "Ver detalle" con:
  - Incluye.
  - Ideal para.
  - Requiere.
  - Accesorios incluidos.
  - Recomendaciones de uso.
- Ejemplo: "Cabezal movil spot LED" debe aclarar "requiere soporte/truss y energia cerca".

### 6. El servicio alrededor del equipo es parte del producto

Soundtec y MR Sonido enfatizan entrega, instalacion, operador, asesoramiento y reemplazos. Esto diferencia a un rental serio de un listado de objetos.

Para MB Systems:

- En el pedido, agregar opciones:
  - Retiro por local.
  - Envio/traslado.
  - Instalacion.
  - Operador tecnico.
  - Necesito asesoramiento.
- En admin, estas opciones deben aparecer como checklist operativo.

### 7. La transparencia operativa reduce mensajes repetidos

Bay AV y otros sitios separan catalogo, disponibilidad, soporte y servicios. Para clientes, lo importante no es solo ver "hay stock", sino entender que pasa despues.

Para MB Systems:

- Agregar una tira "Como funciona":
  1. Elegis fechas.
  2. Sumás equipos o paquetes.
  3. Enviás la solicitud.
  4. MB confirma disponibilidad y retiro.
- Debe ser compacto, no landing page.

### 8. Hay que evitar que parezca ecommerce generico

El rental profesional se siente mas como herramienta de cotizacion que como tienda masiva. Las interfaces mas creibles son densas, limpias, oscuras o neutras, con fotos reales y menos decoracion.

Para MB Systems:

- Mantener tema oscuro premium y texto blanco.
- Evitar heroes gigantes, gradientes decorativos y frases de marketing.
- Priorizar tablero utilitario: fechas, stock, paquetes, catalogo, pedido.
- Usar lenguaje humano: "Te sirve para", "Incluye", "Pocas unidades", "Consultar ajuste".

## Decisiones recomendadas para el MVP

### Hacer ahora

1. Paquetes prearmados.
2. Opciones de servicio en el pedido.
3. Bloque compacto de confianza.
4. Modal/drawer de detalle por item.
5. Mejor texto de confirmacion de reserva.

### Hacer despues

1. Filtros avanzados por potencia, marca o compatibilidad.
2. Calendario publico mas visual por producto.
3. Fotos propias del stock real.
4. Descuentos por varios dias o combos.
5. Pago online real.

### No priorizar todavia

- Landing page de marketing.
- Checkout ecommerce completo.
- Demasiados filtros tecnicos.
- Registro de usuario obligatorio.
- Comparador complejo de productos.

## Propuesta de estructura publica

1. Header con marca, acceso a reserva y admin.
2. Selector de retiro/devolucion.
3. Tira de confianza: stock actualizado, equipos revisados, soporte, retiro coordinado.
4. Paquetes sugeridos.
5. Catalogo tecnico actual.
6. Pedido sticky con resumen, servicios adicionales y datos del cliente.
7. Confirmacion clara con numero de reserva y WhatsApp.

## Propuesta visual

- Fondo: grafito oscuro.
- Marca: texto blanco delicado.
- Fotos: productos reales sobre fondos neutros.
- Tarjetas: compactas, borde fino, datos legibles.
- Estados: verde para disponible, ambar para pocas unidades, rojo para sin stock.
- Botones: claros, grandes, con icono y texto simple.
- Tipografia: sin ornamentacion excesiva, pero con personalidad en el logo.

## Siguiente implementacion sugerida

La mayor mejora de percepcion seria implementar "Paquetes sugeridos" y "Servicios del pedido". Eso cambia la app de catalogo de items a sistema real de reservas para eventos.
