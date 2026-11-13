# Relaciones · estudio abstracto del contacto

Referencia de Paco: [Contraparte, 366:2703](https://www.figma.com/design/5WH8mdXfrLFN3qRFQy1X7p/Contraparte?node-id=366-2703), consultada el 13/11/2026. El esquema distingue Simbiosis, Rechazo, Barrera y Neutro. Esta propuesta explora su traducción con campos de color procedurales, sin reutilizar las imágenes estáticas del esquema como simulación.

Entrar en **Relaciones**, junto a Elemento, Composición y Micro. El enlace `#relaciones` abre directamente el estudio. Cada colonia se mueve con arrastre; sobre el lienzo, A/B elige colonia y las flechas la desplazan (Mayús aumenta el paso). La separación también tiene un deslizante. El contacto sigue el ángulo y el tamaño de los dos cuerpos.

- **Simbiosis:** un campo de color compartido nace cuando se encuentran y ensancha el encuentro. Sus extremos dependen de la zona de contacto.
- **Rechazo:** A conserva su forma; un halo de exclusión recorta B. Puede actuar antes de que se toquen los cuerpos.
- **Barrera:** ambos frentes se recortan alrededor de una frontera común, con una franja y una línea irregular.
- **Neutro:** se conservan ambos contornos y se multiplican sus colores.

Cambiar de relación conserva el par y el instante. **Usar el par del esquema** aplica las familias cromáticas de esa referencia; no cambia posiciones ni identifica especies. **Comparar las cuatro** repite exactamente el mismo par, también al moverlo en una de las vistas. **Aplicar la relación** permite comparar con la superposición de referencia. **Desarrollo del encuentro** recorre el crecimiento visual, sin unidades biológicas.

La receta v3 conserva posiciones, tamaños, relación, materia, colores, fondo y progreso. Abrir receta sigue aceptando v1/v2 con sus validadores anteriores. PNG exporta el instante y comparación actuales a 1024/2048/3072 px sin las guías A/B. El paquete web contiene el mismo campo de contacto y una receta reabrible, con `mountColonias`, `play`, `pause`, `setProgress`, `getRecipe` y `destroy`.

## Componentes y límites

`relations.js` adapta la interfaz existente; `relations-renderer.js` reúne el dibujo para todas las salidas. Los modos y datos anteriores se conservan; el estado de Relaciones se guarda bajo una clave propia. La copia local de Micro se recuperó del repositorio público para comprobar la integración con la versión publicada. El despliegue agrega exclusivamente esta ampliación a la versión remota, conservando sus fuentes y Micro.

Se reutilizan los botones de modo, encabezados, campos nativos, deslizantes, casillas, barra de acciones, lienzo, mensajes y generador ZIP del laboratorio. Apariciones nuevas: selección de cuatro relaciones y encuentro en el panel izquierdo; materia, lectura y exportación a la derecha; recorrido debajo del lienzo. La hoja adicional conserva la escala y la paleta del laboratorio independiente. Es una excepción contextual respecto de la interfaz integrada de Espora; no impone esos valores al mapa o sus inspectores. El foco en el modo nuevo usa fondo/color/brillo, sin aros.

El campo de contacto necesita una representación propia para deformar los dos frentes conjuntamente. Las familias de color, gradientes, bordes suaves, grano y mezcla retoman el vocabulario abstracto existente. No introduce nodos ni modifica la simulación integrada.

La relación es una elección de exploración gráfica. No hay reglas universales por pareja de organismos, identificación por color, química de difusión, consumo de recursos ni calendario calibrado. La asociación visual de «Simbiosis» retoma el nombre del esquema; no diagnostica mutualismo a partir de una placa. La aprobación de esta representación para ARMÁ TU PLACA sigue pendiente de revisión con Paco.

## Comprobaciones

`node herramientas/colonias/verify-relations.cjs` comprueba diferencias entre los cuatro tratamientos, superficie compartida, recorte unilateral, frontera, ausencia de efectos lejos del contacto, desactivación del efecto, intensidad cero, semilla, retroceso, alfa transparente, centros coincidentes, normalización y equivalencia del módulo web.

Los verificadores históricos `verify.cjs` y `verify-direct.cjs` tienen dobles de DOM anteriores a los controles figurativos actuales; `verify-direct.cjs` falla al inicializar `syncFigureControls`, antes de cargar esta ampliación. No se modifican para presentar ese resultado como una comprobación nueva.

Revisión en navegador: cuatro tratamientos y comparación; cambio Micro → Relaciones → Micro; carga de receta v3 guardada desde la interfaz; carga de una receta v2 de 137 capas y conservación de esas capas al alternar Relaciones/Composición; selección A/B y movimiento por flechas; arrastre que actualiza la distancia; disposición a 390 × 844 y retorno al viewport de escritorio. Sin errores de consola en el recorrido inicial. La lectura del PNG con alfa y la equivalencia del módulo web se comprueban en el verificador; la semejanza final con la intención de Paco requiere su revisión.
