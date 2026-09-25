import { autoClassifyProduct } from '../src/lib/shipper-classification';

function test() {
  console.log('=== TEST DE CLASIFICACIÓN SIN ADIVINANZAS ===');

  // Test 1: Order with explicit A1701 in title
  const p1 = {
    description: 'Apple iPad Pro 10.5" 256GB WiFi Rose Gold + Apple Pencil 1st Gen A1701',
    model: '',
    orderNumber: '25-15141-56007',
  };
  const c1 = autoClassifyProduct(p1);
  console.log('P1 (Explicit A1701):', c1.productoNombre, '| Marca:', c1.marca, '| Modelo:', `"${c1.modelo}"`);

  // Test 2: Order with "Wi-Fi or Cellular" but NO A-code in title
  const p2 = {
    description: 'Apple iPad Pro 10.5in - Choose Specs - Wi-Fi or Cellular  -  LCD WHITE SPOTS[Wifi Only,Silver,256GB]',
    model: '',
    orderNumber: '18-15136-37713',
  };
  const c2 = autoClassifyProduct(p2);
  console.log('P2 (NO explicit A-code):', c2.productoNombre, '| Marca:', c2.marca, '| Modelo (Must be empty):', `"${c2.modelo}"`);

  // Test 3: Laptop with NO A-code in title
  const p3 = {
    description: 'Apple Macbook Pro 13" i7-1068NG7 16GB 512GB BATTERY ISSUE',
    model: '',
    orderNumber: '12-15201-10202',
  };
  const c3 = autoClassifyProduct(p3);
  console.log('P3 (Macbook NO explicit):', c3.productoNombre, '| Marca:', c3.marca, '| Modelo (Must be empty):', `"${c3.modelo}"`);

  // Test 4: Item with manual model entered by user
  const p4 = {
    description: 'Apple Macbook Pro 13" i7-1068NG7 16GB 512GB BATTERY ISSUE',
    model: 'A2251',
    orderNumber: '12-15201-10202',
  };
  const c4 = autoClassifyProduct(p4);
  console.log('P4 (User entered A2251):', c4.productoNombre, '| Marca:', c4.marca, '| Modelo:', `"${c4.modelo}"`);
}

test();
