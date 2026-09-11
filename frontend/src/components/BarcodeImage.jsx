import { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

// يعرض صورة SVG لباركود الصنف - تُستخدم في الجدول وفي نافذة الطباعة
export default function BarcodeImage({ value, height = 36, fontSize = 12 }) {
  const svgRef = useRef(null);

  useEffect(() => {
    if (!value || !svgRef.current) return;
    try {
      JsBarcode(svgRef.current, value, {
        format: 'CODE128',
        height,
        fontSize,
        margin: 4,
        displayValue: true,
      });
    } catch (err) {
      // باركود غير صالح للترميز - يُتجاهل بصمت في الواجهة
    }
  }, [value, height, fontSize]);

  if (!value) return null;
  return <svg ref={svgRef} />;
}
