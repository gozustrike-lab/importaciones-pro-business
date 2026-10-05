'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Plane,
  FileSpreadsheet,
  FileText,
  Archive,
  Copy,
  Check,
  AlertTriangle,
  Package,
  ExternalLink,
  Plus,
  Trash2,
  Building2,
  ShieldCheck,
  RefreshCw,
  Calendar,
  User,
  ShoppingBag,
  Send,
  Clock,
  MessageCircle,
  CheckCircle2,
  MapPin,
  ArrowRight,
  Search,
  Filter,
  Truck,
  HelpCircle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { sanitizeSunatModel, inferTechnicalModel } from '@/lib/shipper-classification';

export type ProfileKey = 'fabio' | 'peggy';

interface ImporterProfile {
  key: ProfileKey;
  name: string;
  ruc: string;
  casillero: string;
  address: string;
}

interface ShipperItem {
  id: string;
  selected: boolean;
  assignedProfile: ProfileKey;
  casilleroOrigin?: string; // "SHIPER FABIO CESAR HERRERA BONILLA" | "SHIPER PEGGY LILIANA BONILLA ORDUNA"
  ebayAccount?: string;     // "gozustrike@gmail.com"
  proveedor: string;
  dniRuc: string;
  consignatario: string;
  courier: string;
  trackingUsa: string;
  contenidoGeneral: string;
  paisFabricacion: string;
  valorUsd: number;
  indicaciones: string;
  // Translation fields
  productoNombre: string;
  marca: string;
  modelo: string;
  cantidad: number;
  estado: string;
  numeroFactura: string;
  numeroOperacion: string;
  status?: string;
  actualDeliveryDate?: string;
  isDeliveredInMiami?: boolean;
}

interface DbProduct {
  id: string;
  description: string;
  trackingId: string;
  courier: string;
  purchasePriceUsd: number;
  shippingStatus: string;
  model: string;
  condition: string;
  orderNumber: string;
}

interface DbShipment {
  id: string;
  code: string;
  flightDate: string;
  flightDayLabel: string;
  importerProfile: ProfileKey;
  consigneeName: string;
  consigneeRuc: string;
  courierName: string;
  awbNumber: string;
  status: 'ENVIADO' | 'CONFIRMADO_AWB' | 'EN_VUELO' | 'EN_ADUANA' | 'EN_LIMA' | 'RECIBIDO';
  totalItems: number;
  totalFobUsd: number;
  isUnder200: boolean;
  notes: string;
  whatsappNotes: string;
  emailSentAt: string;
  confirmedAt?: string | null;
  arrivedLimaAt?: string | null;
  deliveredAt?: string | null;
  products?: DbProduct[];
}

// Helper to compute upcoming flight dates (strictly Monday, Wednesday, Friday)
function getUpcomingFlightDates(): Array<{ id: string; labelShort: string; labelLong: string; subjectStr: string }> {
  const dates: Array<{ id: string; labelShort: string; labelLong: string; subjectStr: string }> = [];
  const dayNames = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  const now = new Date();

  for (let i = 0; i < 14 && dates.length < 5; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const dayOfWeek = d.getDay(); // 1 = Mon, 3 = Wed, 5 = Fri
    if (dayOfWeek === 1 || dayOfWeek === 3 || dayOfWeek === 5) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      const name = dayNames[dayOfWeek];

      dates.push({
        id: `${yyyy}-${mm}-${dd}`,
        labelShort: `${name} ${dd}/${mm}`,
        labelLong: `${name} ${dd} ${mm} ${yyyy}`,
        subjectStr: `EMBARCACION ${dd} ${mm} ${yyyy}`,
      });
    }
  }
  return dates;
}

const STATUS_LABELS: Record<string, { label: string; color: string; badgeClass: string; step: number }> = {
  ENVIADO: {
    label: '1. Correo Enviado a Shipper',
    color: 'amber',
    badgeClass: 'bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400',
    step: 1,
  },
  CONFIRMADO_AWB: {
    label: '2. Guía AWB Asignada',
    color: 'blue',
    badgeClass: 'bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400',
    step: 2,
  },
  EN_VUELO: {
    label: '3. En Vuelo Miami ✈️ Lima',
    color: 'purple',
    badgeClass: 'bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-400 font-bold',
    step: 3,
  },
  EN_ADUANA: {
    label: '4. En Aduanas SUNAT',
    color: 'orange',
    badgeClass: 'bg-orange-500/10 text-orange-600 border-orange-500/30 dark:text-orange-400',
    step: 4,
  },
  EN_LIMA: {
    label: '5. En Almacén Shipper Lima',
    color: 'cyan',
    badgeClass: 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30 dark:text-cyan-400 font-bold',
    step: 5,
  },
  RECIBIDO: {
    label: '6. ✅ Recibido & en Stock',
    color: 'emerald',
    badgeClass: 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400 font-black',
    step: 6,
  },
};

export function ShipperTab() {
  // Top-level Navigation: Bitácora vs Preparar
  const [activeTab, setActiveTab] = useState<'bitacora' | 'preparar'>('bitacora');

  // Bitácora State
  const [shipments, setShipments] = useState<DbShipment[]>([]);
  const [loadingShipments, setLoadingShipments] = useState(false);
  const [filterProfile, setFilterProfile] = useState<'all' | 'fabio' | 'peggy'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingAwbId, setEditingAwbId] = useState<string | null>(null);
  const [tempAwb, setTempAwb] = useState('');
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [tempNotes, setTempNotes] = useState('');
  const [savingField, setSavingField] = useState<string | null>(null);

  // Preparation State
  const [downloadingType, setDownloadingType] = useState<string | null>(null);
  const [syncingEbay, setSyncingEbay] = useState(false);
  const [registeringShipment, setRegisteringShipment] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [copiedBody, setCopiedBody] = useState(false);
  const [awb, setAwb] = useState('');

  // Active Importer Profile for preparation
  const [activeProfileKey, setActiveProfileKey] = useState<ProfileKey>('fabio');
  const [peggyRuc, setPeggyRuc] = useState('10091870911');
  const [filterDeliveredMiamiOnly, setFilterDeliveredMiamiOnly] = useState(false);

  const profiles: Record<ProfileKey, ImporterProfile> = useMemo(
    () => ({
      fabio: {
        key: 'fabio',
        name: 'FABIO CESAR HERRERA BONILLA',
        ruc: '10762026835',
        casillero: 'Shiper Fabio César Herrera Bonilla',
        address: '2820 NW 108th Ave, Doral, FL 33172-2139',
      },
      peggy: {
        key: 'peggy',
        name: 'BONILLA ORDUÑA PEGGY LILIANA',
        ruc: peggyRuc,
        casillero: 'Shiper Peggy Liliana Bonilla Orduña',
        address: 'Jr. Puerto Coloma 176, Urb. Lincoln, San Luis, Lima',
      },
    }),
    [peggyRuc]
  );

  const currentProfile = profiles[activeProfileKey];

  // Flight schedule (Mon, Wed, Fri)
  const flightDates = useMemo(() => getUpcomingFlightDates(), []);
  const [selectedFlightId, setSelectedFlightId] = useState(flightDates[0]?.id || '');
  const selectedFlight = flightDates.find((f) => f.id === selectedFlightId) || flightDates[0];

  // Shipment Items State (Real items preloaded)
  const [items, setItems] = useState<ShipperItem[]>([
    {
      id: 'real-item-1',
      selected: true,
      assignedProfile: 'fabio',
      casilleroOrigin: 'SHIPER FABIO CESAR HERRERA BONILLA',
      ebayAccount: 'gozustrike@gmail.com',
      proveedor: 'EBAY',
      dniRuc: '10762026835',
      consignatario: 'FABIO CESAR HERRERA BONILLA',
      courier: 'UPS',
      trackingUsa: '1Z0R2B760325209042',
      contenidoGeneral: 'Apple iPad Pro de 10,5 pulgadas 256 GB Wi-Fi Manchas blancas en la pantalla LCD',
      paisFabricacion: 'CHINA',
      valorUsd: 89.95,
      indicaciones: '',
      productoNombre: 'Tableta Electrónica',
      marca: 'Apple',
      modelo: 'A1701',
      cantidad: 1,
      estado: 'Usado',
      numeroFactura: '22-15116-16018',
      numeroOperacion: '',
    },
    {
      id: 'real-item-2',
      selected: true,
      assignedProfile: 'fabio',
      casilleroOrigin: 'SHIPER FABIO CESAR HERRERA BONILLA',
      ebayAccount: 'gozustrike@gmail.com',
      proveedor: 'EBAY',
      dniRuc: '10762026835',
      consignatario: 'FABIO CESAR HERRERA BONILLA',
      courier: 'UPS',
      trackingUsa: '1Z0R2B760339138058',
      contenidoGeneral: 'Apple iPad Pro de 10,5 pulgadas 256 GB Wi-Fi Manchas blancas en la pantalla LCD',
      paisFabricacion: 'CHINA',
      valorUsd: 89.95,
      indicaciones: '',
      productoNombre: 'Tableta Electrónica',
      marca: 'Apple',
      modelo: 'A1701',
      cantidad: 1,
      estado: 'Usado',
      numeroFactura: '22-15116-16018',
      numeroOperacion: '',
    },
    {
      id: 'real-item-3',
      selected: true,
      assignedProfile: 'fabio',
      casilleroOrigin: 'SHIPER FABIO CESAR HERRERA BONILLA',
      ebayAccount: 'gozustrike@gmail.com',
      proveedor: 'wikiwoo',
      dniRuc: '10762026835',
      consignatario: 'FABIO CESAR HERRERA BONILLA',
      courier: 'UPS',
      trackingUsa: '1Z0R2B760325209042',
      contenidoGeneral: 'Apple iPad Pro 10.5" 256GB WiFi Gris Espacial',
      paisFabricacion: 'CHINA',
      valorUsd: 89.95,
      indicaciones: '',
      productoNombre: 'Tableta Electrónica',
      marca: 'Apple',
      modelo: 'A1701',
      cantidad: 1,
      estado: 'Usado',
      numeroFactura: '23-15114-36516',
      numeroOperacion: '',
    },
  ]);

  // Load Shipments from DB
  const fetchShipments = useCallback(async () => {
    try {
      setLoadingShipments(true);
      const res = await fetch('/api/shipments');
      if (!res.ok) throw new Error('Error al cargar la bitácora de embarques');
      const data = await res.json();
      setShipments(data.shipments || []);
    } catch (err: any) {
      console.error(err);
      toast.error('No se pudo cargar la bitácora de embarques');
    } finally {
      setLoadingShipments(false);
    }
  }, []);

  // Filter items by active profile in preparation tab
  const profileItems = useMemo(() => {
    return items.filter((it) => {
      if (it.assignedProfile !== activeProfileKey) return false;
      if (filterDeliveredMiamiOnly && it.status !== 'USA' && !it.isDeliveredInMiami) return false;
      return true;
    });
  }, [items, activeProfileKey, filterDeliveredMiamiOnly]);

  const selectedProfileItems = profileItems.filter((it) => it.selected);

  // Total FOB calculation for the currently active profile in preparation
  const totalFobUsd = selectedProfileItems.reduce((acc, it) => acc + (Number(it.valorUsd) || 0), 0);
  const isUnder200 = totalFobUsd <= 200.0;

  // Toggle selection
  const toggleSelectAll = (checked: boolean) => {
    setItems(
      items.map((it) => (it.assignedProfile === activeProfileKey ? { ...it, selected: checked } : it))
    );
  };

  const toggleItem = (id: string) => {
    setItems(items.map((it) => (it.id === id ? { ...it, selected: !it.selected } : it)));
  };

  const updateItem = (id: string, field: keyof ShipperItem, value: any) => {
    setItems(items.map((it) => (it.id === id ? { ...it, [field]: value } : it)));
  };

  const removeItem = (id: string) => {
    setItems(items.filter((it) => it.id !== id));
  };

  const addNewItem = () => {
    const newItem: ShipperItem = {
      id: `custom-${Date.now()}`,
      selected: true,
      assignedProfile: activeProfileKey,
      casilleroOrigin: currentProfile.casillero,
      ebayAccount: 'gozustrike@gmail.com',
      proveedor: 'EBAY',
      dniRuc: currentProfile.ruc,
      consignatario: currentProfile.name,
      courier: 'UPS',
      trackingUsa: '',
      contenidoGeneral: '',
      paisFabricacion: 'CHINA',
      valorUsd: 0,
      indicaciones: '',
      productoNombre: 'Dispositivo Electrónico',
      marca: 'Apple',
      modelo: '',
      cantidad: 1,
      estado: 'Usado',
      numeroFactura: '',
      numeroOperacion: '',
    };
    setItems([...items, newItem]);
  };

  // Sync purchases from eBay API
  const handleSyncEbay = useCallback(async (isAuto = false) => {
    try {
      setSyncingEbay(true);
      const res = await fetch('/api/ebay/orders?syncDb=true');
      if (!res.ok) throw new Error('Error al sincronizar con eBay');
      const data = await res.json();

      if (data.requiresAuth) {
        if (!isAuto) {
          toast.error('Tu sesión de eBay expiró. Reconecta tu cuenta en la pestaña Inventario para sincronizar compras en vivo.');
        }
        return;
      }

      const syncedOrders = data.orders || [];
      if (syncedOrders.length > 0) {
        const newItems: ShipperItem[] = syncedOrders.map((ord: any, idx: number) => {
          const isPeggy =
            (ord.recipientName || '').toLowerCase().includes('peggy') ||
            (ord.recipientName || '').toLowerCase().includes('liliana') ||
            (ord.recipientName || '').toLowerCase().includes('orduna') ||
            (ord.recipientName || '').toLowerCase().includes('orduña') ||
            ord.assignedProfile === 'peggy';
          const profile: ProfileKey = isPeggy ? 'peggy' : 'fabio';
          const profRuc = isPeggy ? peggyRuc : '10762026835';
          const profName = isPeggy ? 'BONILLA ORDUÑA PEGGY LILIANA' : 'FABIO CESAR HERRERA BONILLA';

          const titleLower = (ord.title || '').toLowerCase();
          const isTablet = titleLower.includes('ipad');
          const isPhone = titleLower.includes('iphone');
          const isMac = titleLower.includes('macbook') || titleLower.includes('mac');
          const prodNombre = isTablet
            ? 'Tableta Electrónica'
            : isPhone
            ? 'Teléfono Celular'
            : isMac
            ? 'Laptop Portátil'
            : 'Dispositivo Electrónico';

          // Extract exact Apple model (strictly A#### code for SUNAT customs compliance)
          const modelo = inferTechnicalModel(ord.title, ord.model);

          const isDelivered = ord.status === 'USA' || !!ord.actualDeliveryDate;

          return {
            id: `ebay-${ord.orderId}-${idx}`,
            selected: isDelivered,
            assignedProfile: profile,
            casilleroOrigin: ord.recipientName || (isPeggy ? 'SHIPER PEGGY LILIANA BONILLA ORDUNA' : 'SHIPER FABIO CESAR HERRERA BONILLA'),
            ebayAccount: ord.ebayAccount || 'gozustrike@gmail.com',
            proveedor: 'EBAY',
            dniRuc: profRuc,
            consignatario: profName,
            courier: ord.courier || 'USPS',
            trackingUsa: ord.trackingNumber || '',
            contenidoGeneral: ord.title,
            paisFabricacion: 'CHINA',
            valorUsd: ord.priceUsd || 0,
            indicaciones: '',
            productoNombre: prodNombre,
            marca: 'Apple',
            modelo: modelo,
            cantidad: 1,
            estado: ord.condition || 'Usado',
            numeroFactura: ord.rawOrderId || ord.orderId,
            numeroOperacion: '',
            status: ord.status || (isDelivered ? 'USA' : 'TRANSITO_USA'),
            actualDeliveryDate: ord.actualDeliveryDate || undefined,
            isDeliveredInMiami: isDelivered,
          };
        });

        // Replace mock items if this is the first real sync
        setItems((prevItems) => {
          const hasOnlyMocks = prevItems.every((i) => i.id.startsWith('real-item-'));
          if (hasOnlyMocks) {
            return newItems;
          }
          const existingTrackings = new Set(prevItems.map((i) => i.trackingUsa).filter(Boolean));
          const existingInvoices = new Set(prevItems.map((i) => i.numeroFactura).filter(Boolean));
          const toAdd = newItems.filter((i) => {
            if (i.trackingUsa && existingTrackings.has(i.trackingUsa)) return false;
            if (!i.trackingUsa && i.numeroFactura && existingInvoices.has(i.numeroFactura)) return false;
            return true;
          });
          return [...prevItems, ...toAdd];
        });

        const fabioCount = newItems.filter((i) => i.assignedProfile === 'fabio').length;
        const peggyCount = newItems.filter((i) => i.assignedProfile === 'peggy').length;

        if (!isAuto) {
          toast.success(
            `¡Sincronizado con eBay! ${newItems.length} compras reales: ${fabioCount} a Fabio (RUC 10762026835) y ${peggyCount} a Peggy (RUC ${peggyRuc}) según casillero.`
          );
        }
      }
    } catch (err: any) {
      if (!isAuto) {
        toast.error(err.message || 'Error al conectar con eBay');
      }
    } finally {
      setSyncingEbay(false);
    }
  }, [peggyRuc]);

  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    fetchShipments();
    handleSyncEbay(true);
  }, [fetchShipments, handleSyncEbay]);

  // Download Hoja de Embarque Excel
  const handleDownloadEmbarque = async () => {
    if (!selectedProfileItems.length) {
      toast.error(`Selecciona al menos un producto para ${currentProfile.name}`);
      return;
    }

    try {
      setDownloadingType('embarque');
      const payload = {
        items: selectedProfileItems.map((it) => ({
          proveedor: it.proveedor,
          dniRuc: currentProfile.ruc,
          consignatario: currentProfile.name,
          courier: it.courier,
          trackingUsa: it.trackingUsa,
          contenidoGeneral: it.contenidoGeneral,
          paisFabricacion: it.paisFabricacion,
          valorUsd: it.valorUsd,
          indicaciones: it.indicaciones,
        })),
        ruc: currentProfile.ruc,
        name: currentProfile.name,
      };

      const res = await fetch('/api/shipper/embarque', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Error al generar archivo Excel de Embarque');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SHIPER_ORDEN_DE_EMBARQUE_${activeProfileKey.toUpperCase()}_${selectedFlight?.subjectStr.replace(' ', '_')}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success(`¡Hoja de Embarque de ${currentProfile.name} generada con éxito!`);
    } catch (err: any) {
      toast.error(err.message || 'Error descargando archivo');
    } finally {
      setDownloadingType(null);
    }
  };

  // Download Hoja de Traducción Excel
  const handleDownloadTraduccion = async () => {
    if (!selectedProfileItems.length) {
      toast.error('Selecciona al menos un producto');
      return;
    }

    try {
      setDownloadingType('traduccion');
      const payload = {
        items: selectedProfileItems.map((it) => ({
          productoNombre: it.productoNombre,
          marca: it.marca,
          modelo: sanitizeSunatModel(it.modelo),
          paisFabricacion: it.paisFabricacion,
          cantidad: it.cantidad,
          estado: it.estado,
          numeroFactura: it.numeroFactura,
          numeroOperacion: it.numeroOperacion,
        })),
        awb,
      };

      const res = await fetch('/api/shipper/traduccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Error al generar traducción de factura');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DECLARACION_JURADA_TRADUCCION_${activeProfileKey.toUpperCase()}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('¡Hoja de Traducción SUNAT generada con éxito!');
    } catch (err: any) {
      toast.error(err.message || 'Error descargando archivo');
    } finally {
      setDownloadingType(null);
    }
  };

  // Download Ficha RUC PDF
  const handleDownloadFichaRuc = () => {
    const a = document.createElement('a');
    a.href = `/api/shipper/ficha-ruc?profile=${activeProfileKey}`;
    a.download = `SUNAT_FICHA_RUC_${activeProfileKey.toUpperCase()}_${currentProfile.ruc}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Descargando Ficha RUC (${currentProfile.ruc})...`);
  };

  // Download Bundle ZIP
  const handleDownloadBundle = async () => {
    if (!selectedProfileItems.length) {
      toast.error('Selecciona al menos un producto');
      return;
    }

    try {
      setDownloadingType('bundle');
      const payload = {
        profile: activeProfileKey,
        embarqueItems: selectedProfileItems.map((it) => ({
          proveedor: it.proveedor,
          dniRuc: currentProfile.ruc,
          consignatario: currentProfile.name,
          courier: it.courier,
          trackingUsa: it.trackingUsa,
          contenidoGeneral: it.contenidoGeneral,
          paisFabricacion: it.paisFabricacion,
          valorUsd: it.valorUsd,
          indicaciones: it.indicaciones,
        })),
        traduccionItems: selectedProfileItems.map((it) => ({
          productoNombre: it.productoNombre,
          marca: it.marca,
          modelo: sanitizeSunatModel(it.modelo),
          paisFabricacion: it.paisFabricacion,
          cantidad: it.cantidad,
          estado: it.estado,
          numeroFactura: it.numeroFactura,
          numeroOperacion: it.numeroOperacion,
        })),
        awb,
        ruc: currentProfile.ruc,
        name: currentProfile.name,
      };

      const res = await fetch('/api/shipper/bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Error al empaquetar expediente');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EXPEDIENTE_${activeProfileKey.toUpperCase()}_${selectedFlight?.subjectStr.replace(/ /g, '_')}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success('¡Expediente completo descargado en ZIP!');
    } catch (err: any) {
      toast.error(err.message || 'Error descargando expediente ZIP');
    } finally {
      setDownloadingType(null);
    }
  };

  // Register Shipment in Database Bitácora
  const handleRegisterShipment = async () => {
    if (!selectedProfileItems.length) {
      toast.error(`Selecciona al menos un paquete para registrar el embarque de ${currentProfile.name}`);
      return;
    }

    try {
      setRegisteringShipment(true);
      const trackingList = selectedProfileItems.map((i) => i.trackingUsa).filter(Boolean);

      const payload = {
        flightDate: selectedFlight?.id ? new Date(`${selectedFlight.id}T12:00:00Z`).toISOString() : new Date().toISOString(),
        flightDayLabel: selectedFlight?.labelLong || 'LUNES 14 09 2026',
        importerProfile: activeProfileKey,
        consigneeName: currentProfile.name,
        consigneeRuc: currentProfile.ruc,
        trackingNumbers: trackingList,
        fallbackFobUsd: totalFobUsd,
        totalItems: selectedProfileItems.length,
        awbNumber: awb.trim(),
        notes: `Expediente generado desde plataforma para vuelo ${selectedFlight?.labelShort}`,
        whatsappNotes: 'Pre-alerta enviada por correo. Pendiente confirmación de AWB por Shipper vía WhatsApp.',
      };

      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar embarque');

      toast.success(`🎉 ¡Embarque ${data.shipment?.code || ''} registrado con éxito en la Bitácora!`);
      await fetchShipments();
      setActiveTab('bitacora');
    } catch (err: any) {
      toast.error(err.message || 'Error registrando embarque en base de datos');
    } finally {
      setRegisteringShipment(false);
    }
  };

  // Update Shipment Field (AWB, WhatsApp notes, Status)
  const handleUpdateShipment = async (id: string, updateData: any) => {
    try {
      setSavingField(id);
      const res = await fetch(`/api/shipments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al actualizar embarque');

      toast.success('Embarque actualizado');
      setShipments((prev) => prev.map((s) => (s.id === id ? data.shipment : s)));
      setEditingAwbId(null);
      setEditingNotesId(null);
    } catch (err: any) {
      toast.error(err.message || 'Error al actualizar');
    } finally {
      setSavingField(null);
    }
  };

  // Mark as Received in Lima
  const handleMarkReceived = async (id: string, code: string) => {
    if (!confirm(`¿Confirmas que el embarque ${code} llegó a Lima y los productos ya están en tu almacén? Esto actualizará su estado a Recibido y los ingresará al stock disponible.`)) {
      return;
    }
    await handleUpdateShipment(id, { markReceived: true });
    toast.success(`📦 ¡Embarque ${code} recibido! Productos añadidos a inventario listo para venta.`);
  };

  // Delete / Unlink Shipment
  const handleDeleteShipment = async (id: string, code: string) => {
    if (!confirm(`¿Estás seguro de eliminar el embarque ${code}? Los productos volverán al casillero USA para poder reprogramarlos.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/shipments/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al eliminar embarque');
      toast.info(`Embarque ${code} eliminado. Productos devueltos a casillero USA.`);
      setShipments((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      toast.error(err.message || 'Error eliminando embarque');
    }
  };

  // Exact Email Format matching user's Gmail sent screenshot
  const emailTo = 'operaciones@shiper.pe';
  const emailCc = 'gozustrike@gmail.com';
  const emailSubject = selectedFlight?.subjectStr || 'EMBARCACION 14 09 2026';

  const emailBody = `${currentProfile.name}

Adjunto las órdenes de compra, certificado de homologacion, copia de formato de traducción,  ficha RUC y documento de embarcación para el ${selectedFlight?.labelLong || 'LUNES 14 09 2026'}, espero su pronta respuesta, gracias.

Detallar correctamente los documentos que son usados y leer el origen en el formato de traducción`;

  const copyToClipboard = (text: string, isSubject: boolean) => {
    navigator.clipboard.writeText(text);
    if (isSubject) {
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 2000);
    } else {
      setCopiedBody(true);
      setTimeout(() => setCopiedBody(false), 2000);
    }
    toast.success('Copiado al portapapeles');
  };

  // Gmail Web direct link
  const openInGmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(emailTo)}&cc=${encodeURIComponent(emailCc)}&su=${encodeURIComponent(emailSubject)}&body=${encodeURIComponent(emailBody)}`;

  // Filtered shipments for Bitácora view
  const filteredShipments = useMemo(() => {
    return shipments.filter((s) => {
      if (filterProfile !== 'all' && s.importerProfile !== filterProfile) return false;
      if (filterStatus !== 'all' && s.status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesCode = s.code.toLowerCase().includes(q);
        const matchesAwb = s.awbNumber.toLowerCase().includes(q);
        const matchesName = s.consigneeName.toLowerCase().includes(q);
        const matchesWhatsapp = (s.whatsappNotes || '').toLowerCase().includes(q);
        const matchesProducts = s.products?.some(
          (p) =>
            p.description.toLowerCase().includes(q) ||
            p.trackingId.toLowerCase().includes(q) ||
            p.model.toLowerCase().includes(q)
        );
        return matchesCode || matchesAwb || matchesName || matchesWhatsapp || matchesProducts;
      }
      return true;
    });
  }, [shipments, filterProfile, filterStatus, searchQuery]);

  // Active / KPI stats
  const activeFlightsCount = shipments.filter((s) => s.status === 'EN_VUELO' || s.status === 'CONFIRMADO_AWB' || s.status === 'ENVIADO').length;
  const pendingAwbCount = shipments.filter((s) => s.status === 'ENVIADO' && !s.awbNumber).length;
  const inLimaCount = shipments.filter((s) => s.status === 'EN_LIMA').length;
  const receivedCount = shipments.filter((s) => s.status === 'RECIBIDO').length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b pb-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md">
              <Plane className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Logística & Despacho Shipper</h1>
              <p className="text-xs text-muted-foreground">
                Control de vuelos Lunes, Miércoles y Viernes • Soporte Bi-RUC (Fabio & Peggy) • Seguimiento WhatsApp y AWBs
              </p>
            </div>
          </div>
        </div>

        {/* Global Action buttons */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchShipments}
            disabled={loadingShipments}
            className="gap-2 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingShipments ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>

          <Button
            size="sm"
            onClick={() => setActiveTab(activeTab === 'bitacora' ? 'preparar' : 'bitacora')}
            className={`gap-2 text-xs font-semibold ${
              activeTab === 'bitacora'
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
            }`}
          >
            {activeTab === 'bitacora' ? (
              <>
                <Plus className="h-4 w-4" /> Preparar Nuevo Embarque
              </>
            ) : (
              <>
                <Clock className="h-4 w-4" /> Ver Bitácora de Vuelos
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md h-11 p-1 bg-muted/60">
          <TabsTrigger value="bitacora" className="gap-2 font-semibold text-xs sm:text-sm">
            <Clock className="h-4 w-4 text-emerald-600" />
            Bitácora & Trazabilidad
            {activeFlightsCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                {activeFlightsCount} activo{activeFlightsCount > 1 ? 's' : ''}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="preparar" className="gap-2 font-semibold text-xs sm:text-sm">
            <Send className="h-4 w-4 text-blue-600" />
            Preparar Nuevo Embarque
          </TabsTrigger>
        </TabsList>

        {/* ======================================================== */}
        {/* TAB 1: BITÁCORA & TRAZABILIDAD DE VUELOS                 */}
        {/* ======================================================== */}
        <TabsContent value="bitacora" className="space-y-6 pt-2">
          {/* Quick Metrics Cards */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <Card className="border-l-4 border-l-purple-500 bg-card shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">En Vuelo / Tránsito</p>
                  <p className="text-2xl font-black text-foreground mt-0.5">{activeFlightsCount}</p>
                  <p className="text-[11px] text-purple-600 dark:text-purple-400 font-medium">Miami ✈️ Lima</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-600">
                  <Plane className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-amber-500 bg-card shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Esperando Guía AWB</p>
                  <p className="text-2xl font-black text-foreground mt-0.5">{pendingAwbCount}</p>
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">Consultar por WhatsApp</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-600">
                  <MessageCircle className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-cyan-500 bg-card shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">En Almacén Lima</p>
                  <p className="text-2xl font-black text-foreground mt-0.5">{inLimaCount}</p>
                  <p className="text-[11px] text-cyan-600 dark:text-cyan-400 font-medium">Listo para recojo</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-600">
                  <MapPin className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500 bg-card shadow-sm">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase">Recibidos en Taller</p>
                  <p className="text-2xl font-black text-foreground mt-0.5">{receivedCount}</p>
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">Stock disponible</p>
                </div>
                <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filter Bar */}
          <Card className="shadow-sm border">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                {/* Profile Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">Perfil:</span>
                  <div className="flex gap-1.5">
                    <Button
                      variant={filterProfile === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterProfile('all')}
                      className="h-8 text-xs font-medium"
                    >
                      Todos ({shipments.length})
                    </Button>
                    <Button
                      variant={filterProfile === 'fabio' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterProfile('fabio')}
                      className={`h-8 text-xs font-medium ${filterProfile === 'fabio' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                    >
                      👤 Fabio ({shipments.filter((s) => s.importerProfile === 'fabio').length})
                    </Button>
                    <Button
                      variant={filterProfile === 'peggy' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setFilterProfile('peggy')}
                      className={`h-8 text-xs font-medium ${filterProfile === 'peggy' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                    >
                      👤 Peggy ({shipments.filter((s) => s.importerProfile === 'peggy').length})
                    </Button>
                  </div>
                </div>

                {/* Status & Search */}
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="h-8 text-xs rounded-md border bg-background px-2.5 font-medium text-foreground focus:outline-none"
                  >
                    <option value="all">Todos los Estados</option>
                    <option value="ENVIADO">1. Enviado a Shipper</option>
                    <option value="CONFIRMADO_AWB">2. Con Guía AWB</option>
                    <option value="EN_VUELO">3. En Vuelo Miami-Lima</option>
                    <option value="EN_ADUANA">4. En Aduanas SUNAT</option>
                    <option value="EN_LIMA">5. En Almacén Lima</option>
                    <option value="RECIBIDO">6. Recibido</option>
                  </select>

                  <div className="relative min-w-[200px]">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por código, AWB o producto..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 pl-8 text-xs"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Shipment List */}
          {loadingShipments ? (
            <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
              <RefreshCw className="h-8 w-8 animate-spin text-emerald-600 mb-2" />
              <p className="text-sm">Cargando bitácora de embarques...</p>
            </div>
          ) : filteredShipments.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <Plane className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="text-base font-bold text-foreground">No hay embarques en este filtro</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                No se encontraron vuelos registrados con los criterios seleccionados. Puedes preparar un nuevo embarque desde la pestaña superior.
              </p>
              <Button
                size="sm"
                onClick={() => setActiveTab('preparar')}
                className="mt-4 gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
              >
                <Plus className="h-4 w-4" /> Preparar Primer Embarque
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {filteredShipments.map((s) => {
                const statusMeta = STATUS_LABELS[s.status] || STATUS_LABELS.ENVIADO;
                const isFabio = s.importerProfile === 'fabio';

                return (
                  <Card key={s.id} className="border-2 shadow-sm hover:shadow-md transition-shadow">
                    {/* Header Bar */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-4 border-b bg-muted/20">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono font-bold text-sm text-foreground bg-background px-2.5 py-1 rounded border shadow-xs">
                          {s.code}
                        </span>

                        <Badge
                          variant="outline"
                          className={
                            isFabio
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 font-bold'
                              : 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-bold'
                          }
                        >
                          👤 {isFabio ? 'FABIO HERRERA' : 'PEGGY BONILLA'} (RUC: {s.consigneeRuc})
                        </Badge>

                        <Badge variant="outline" className="border-blue-500/40 bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-medium text-xs">
                          ✈️ {s.flightDayLabel}
                        </Badge>

                        <Badge variant="outline" className={statusMeta.badgeClass}>
                          {statusMeta.label}
                        </Badge>
                      </div>

                      {/* Main FOB and Quick Action */}
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground font-medium">Total FOB Declarado</p>
                          <p className="text-base font-black text-foreground">
                            ${s.totalFobUsd.toFixed(2)} USD
                            <span className="text-[11px] font-normal text-muted-foreground ml-1">
                              ({s.totalItems} paquete{s.totalItems > 1 ? 's' : ''})
                            </span>
                          </p>
                        </div>

                        {s.status !== 'RECIBIDO' ? (
                          <Button
                            size="sm"
                            onClick={() => handleMarkReceived(s.id, s.code)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs gap-1.5 shadow-sm"
                          >
                            <CheckCircle2 className="h-4 w-4" /> Marcar Recibido en Lima
                          </Button>
                        ) : (
                          <Badge variant="default" className="bg-emerald-600 text-white font-bold px-3 py-1 text-xs gap-1">
                            <Check className="h-3.5 w-3.5" /> En Inventario Lima
                          </Badge>
                        )}
                      </div>
                    </div>

                    <CardContent className="p-4 space-y-4">
                      {/* Grid: AWB + WhatsApp Notes + Status Selector */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 1. Guía AWB Shipper */}
                        <div className="p-3 rounded-lg border bg-card space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                              <Truck className="h-4 w-4 text-primary" /> Guía AWB Courier
                            </span>
                            {s.awbNumber && editingAwbId !== s.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingAwbId(s.id);
                                  setTempAwb(s.awbNumber);
                                }}
                                className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                              >
                                Editar
                              </Button>
                            )}
                          </div>

                          {editingAwbId === s.id || !s.awbNumber ? (
                            <div className="space-y-1.5">
                              <Input
                                placeholder="Ej: SHP-89210-LIM"
                                value={editingAwbId === s.id ? tempAwb : tempAwb || ''}
                                onChange={(e) => {
                                  setEditingAwbId(s.id);
                                  setTempAwb(e.target.value);
                                }}
                                className="h-8 font-mono text-xs"
                              />
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  onClick={() => handleUpdateShipment(s.id, { awbNumber: tempAwb })}
                                  disabled={savingField === s.id || !tempAwb.trim()}
                                  className="h-7 text-xs flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                  {savingField === s.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Guardar AWB'}
                                </Button>
                                {editingAwbId === s.id && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setEditingAwbId(null)}
                                    className="h-7 text-xs"
                                  >
                                    Cancelar
                                  </Button>
                                )}
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                Ingresa la guía cuando Shipper te responda por WhatsApp.
                              </p>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <p className="font-mono text-base font-black text-blue-600 dark:text-blue-400">
                                {s.awbNumber}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                Asignada por Shipper para el vuelo a Lima.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* 2. WhatsApp Notes / Courier Tracking */}
                        <div className="p-3 rounded-lg border bg-card space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                              <MessageCircle className="h-4 w-4" /> Bitácora WhatsApp Shipper
                            </span>
                            {editingNotesId !== s.id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setEditingNotesId(s.id);
                                  setTempNotes(s.whatsappNotes || '');
                                }}
                                className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                              >
                                {s.whatsappNotes ? 'Modificar' : '+ Agregar'}
                              </Button>
                            )}
                          </div>

                          {editingNotesId === s.id ? (
                            <div className="space-y-1.5">
                              <textarea
                                value={tempNotes}
                                onChange={(e) => setTempNotes(e.target.value)}
                                placeholder="Escribe lo que respondió el courier por WhatsApp (retrasos, vuelo, llegada)..."
                                className="w-full text-xs p-2 rounded-md border bg-background text-foreground min-h-[60px] focus:outline-none focus:ring-1 focus:ring-emerald-500 font-sans"
                              />
                              <div className="flex gap-1.5">
                                <Button
                                  size="sm"
                                  onClick={() => handleUpdateShipment(s.id, { whatsappNotes: tempNotes })}
                                  disabled={savingField === s.id}
                                  className="h-7 text-xs flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                                >
                                  {savingField === s.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : 'Guardar Nota'}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingNotesId(null)}
                                  className="h-7 text-xs"
                                >
                                  Cancelar
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground bg-muted/30 p-2 rounded border min-h-[50px]">
                              {s.whatsappNotes ? (
                                <p className="text-foreground leading-relaxed italic">{s.whatsappNotes}</p>
                              ) : (
                                <p className="text-muted-foreground/60 italic">Sin notas de WhatsApp aún. Registra aquí lo que te responda el courier.</p>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 3. Status Selector & Pipeline */}
                        <div className="p-3 rounded-lg border bg-card space-y-2">
                          <span className="text-xs font-bold text-foreground block">
                            Estado del Envío:
                          </span>
                          <select
                            value={s.status}
                            onChange={(e) => handleUpdateShipment(s.id, { status: e.target.value })}
                            className="w-full h-8 text-xs rounded-md border bg-background px-2 font-semibold text-foreground"
                          >
                            <option value="ENVIADO">1. Correo Enviado a Shipper</option>
                            <option value="CONFIRMADO_AWB">2. AWB Confirmado por Courier</option>
                            <option value="EN_VUELO">3. En Vuelo Miami ✈️ Lima</option>
                            <option value="EN_ADUANA">4. En Aduanas SUNAT</option>
                            <option value="EN_LIMA">5. En Almacén Shipper Lima</option>
                            <option value="RECIBIDO">6. ✅ Recibido en Taller (Stock)</option>
                          </select>

                          <div className="pt-2 flex items-center justify-between border-t text-[11px] text-muted-foreground">
                            <span>Inafecto SUNAT:</span>
                            <Badge variant={s.isUnder200 ? 'default' : 'destructive'} className={s.isUnder200 ? 'bg-emerald-600 text-[10px]' : 'text-[10px]'}>
                              {s.isUnder200 ? 'EXONERADO (≤$200)' : 'AFECTO IMPUESTOS'}
                            </Badge>
                          </div>

                          <div className="flex justify-end pt-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteShipment(s.id, s.code)}
                              className="h-6 px-2 text-[10px] text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                            >
                              <Trash2 className="h-3 w-3 mr-1" /> Deshacer Embarque
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Products in this Shipment */}
                      {s.products && s.products.length > 0 && (
                        <div className="rounded-lg border bg-muted/10 overflow-hidden">
                          <div className="bg-muted/40 px-3 py-1.5 border-b text-[11px] font-bold text-muted-foreground flex items-center justify-between">
                            <span>📦 Dispositivos en este Embarque ({s.products.length})</span>
                            <span>Valor FOB Total: ${s.totalFobUsd.toFixed(2)} USD</span>
                          </div>
                          <div className="divide-y text-xs">
                            {s.products.map((prod) => (
                              <div key={prod.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/20">
                                <div className="space-y-0.5">
                                  <p className="font-semibold text-foreground">{prod.description}</p>
                                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground font-mono">
                                    <span>Tracking USA: <strong className="text-foreground">{prod.trackingId || 'N/A'}</strong></span>
                                    <span>• Courier: {prod.courier || 'UPS'}</span>
                                    <span>• Orden: {prod.orderNumber || 'N/A'}</span>
                                  </div>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm font-mono">
                                    ${prod.purchasePriceUsd?.toFixed(2)} USD
                                  </span>
                                  <p className="text-[10px] text-muted-foreground">S/ {(prod.purchasePriceUsd * 3.40).toFixed(2)} PEN (T.C. 3.40)</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ======================================================== */}
        {/* TAB 2: PREPARAR NUEVO EMBARQUE                           */}
        {/* ======================================================== */}
        <TabsContent value="preparar" className="space-y-6 pt-2">
          {/* Quick Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border bg-gradient-to-r from-emerald-500/10 via-background to-blue-500/10">
            <div>
              <h2 className="text-lg font-bold text-foreground">Preparación de Expediente & Documentos SUNAT</h2>
              <p className="text-xs text-muted-foreground">
                Selecciona la fecha de vuelo ({selectedFlight?.labelLong}), asigna paquetes a Fabio o Peggy y genera los archivos oficiales.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSyncEbay(false)}
                disabled={syncingEbay}
                className="gap-2 border-blue-500/40 hover:bg-blue-50 dark:hover:bg-blue-950/30 font-medium text-xs h-9"
              >
                <ShoppingBag className={`h-4 w-4 text-blue-600 ${syncingEbay ? 'animate-bounce' : ''}`} />
                {syncingEbay ? 'Sincronizando...' : 'Leer Compras de eBay'}
              </Button>

              <Button
                size="sm"
                onClick={handleDownloadBundle}
                disabled={downloadingType === 'bundle' || !selectedProfileItems.length}
                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm font-semibold gap-2 text-xs h-9"
              >
                {downloadingType === 'bundle' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Archive className="h-4 w-4" />}
                Descargar Expediente ZIP
              </Button>

              <Button
                size="sm"
                onClick={handleRegisterShipment}
                disabled={registeringShipment || !selectedProfileItems.length}
                className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-semibold gap-2 text-xs h-9"
              >
                {registeringShipment ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Plane className="h-4 w-4" />}
                📦 Registrar en Bitácora
              </Button>
            </div>
          </div>

          {/* 1. Importer Profile Selector (Fabio vs Peggy) */}
          <Card className="border-2 border-primary/20 bg-muted/20 shadow-sm">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Perfil de Importador / RUC Activo</h3>
                    <p className="text-xs text-muted-foreground">Alterna entre tus cuentas para generar documentos y controlar el tope de $200 USD por cada RUC</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={activeProfileKey === 'fabio' ? 'default' : 'outline'}
                    onClick={() => setActiveProfileKey('fabio')}
                    className={`gap-2 h-9 text-xs font-semibold ${activeProfileKey === 'fabio' ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                  >
                    👤 FABIO CÉSAR HERRERA (RUC: 10762026835)
                    <Badge variant="secondary" className="ml-1 text-[10px] bg-white/20">
                      {items.filter((i) => i.assignedProfile === 'fabio').length}
                    </Badge>
                  </Button>

                  <Button
                    variant={activeProfileKey === 'peggy' ? 'default' : 'outline'}
                    onClick={() => setActiveProfileKey('peggy')}
                    className={`gap-2 h-9 text-xs font-semibold ${activeProfileKey === 'peggy' ? 'bg-purple-600 hover:bg-purple-700 text-white' : ''}`}
                  >
                    👤 PEGGY LILIANA BONILLA (RUC: {peggyRuc})
                    <Badge variant="secondary" className="ml-1 text-[10px] bg-white/20">
                      {items.filter((i) => i.assignedProfile === 'peggy').length}
                    </Badge>
                  </Button>
                </div>
              </div>

              {/* Automatic SUNAT Bi-RUC rule notice */}
              <div className="mt-3 pt-3 border-t border-border/60 flex items-start gap-2.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                <p className="leading-relaxed">
                  <strong className="text-foreground">Asignación Automática SUNAT:</strong> Si la compra se hace con casillero <strong className="text-purple-600 dark:text-purple-400">SHIPER PEGGY...</strong> se vincula a su RUC 10091870911 con su Ficha RUC. Si se hace con <strong className="text-emerald-600 dark:text-emerald-400">SHIPER FABIO...</strong> se vincula a su RUC 10762026835 con su Ficha RUC. Cada cuenta/RUC maneja su propio historial y tope de $200 USD.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* 2. Flight Date Calendar Selector (Lunes, Miércoles, Viernes) */}
          <Card className="border-l-4 border-l-emerald-600 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-emerald-600" />
                  <div>
                    <CardTitle className="text-base">Próximo Vuelo / Fecha de Embarque (Shipper)</CardTitle>
                    <CardDescription>
                      Shipper despacha exclusivamente los días <strong>Lunes, Miércoles y Viernes</strong>. Selecciona el día para sincronizar el asunto y cuerpo del correo.
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {flightDates.map((f, idx) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setSelectedFlightId(f.id)}
                    className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                      selectedFlightId === f.id
                        ? 'border-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold shadow-sm ring-2 ring-emerald-500/20'
                        : 'border-muted bg-card hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    <span className="text-[10px] tracking-wider uppercase font-semibold">{idx === 0 ? '✈️ PRÓXIMO' : 'FECHA VUELO'}</span>
                    <span className="text-sm font-bold text-foreground mt-0.5">{f.labelShort}</span>
                    <span className="text-[10px] opacity-75 font-mono">{f.subjectStr}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 3. Info & Status Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            {/* Casillero Card */}
            <Card className="border-l-4 border-l-blue-500">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Consignatario & Casillero Activo</CardTitle>
                  <Building2 className="h-4 w-4 text-blue-500" />
                </div>
              </CardHeader>
              <CardContent className="space-y-1 text-xs">
                <p className="font-bold text-foreground text-sm">{currentProfile.name}</p>
                <p className="text-muted-foreground">{currentProfile.casillero}</p>
                <p className="text-muted-foreground">
                  RUC:{' '}
                  {activeProfileKey === 'peggy' ? (
                    <input
                      value={peggyRuc}
                      onChange={(e) => setPeggyRuc(e.target.value)}
                      className="w-28 font-mono font-bold text-foreground bg-transparent border-b border-dashed border-gray-400 focus:outline-none text-xs"
                    />
                  ) : (
                    <span className="font-mono font-bold text-foreground">{currentProfile.ruc}</span>
                  )}
                </p>
              </CardContent>
            </Card>

            {/* FOB Threshold Monitor Card */}
            <Card className={`border-l-4 ${isUnder200 ? 'border-l-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/10' : 'border-l-red-500 bg-red-50/20 dark:bg-red-950/10'}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Límite Aduanal SUNAT ($200 USD)</CardTitle>
                  {isUnder200 ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> : <AlertTriangle className="h-5 w-5 text-red-600" />}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-2xl font-black">${totalFobUsd.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">USD FOB ({currentProfile.name.split(' ')[0]})</span></span>
                  <Badge variant={isUnder200 ? 'default' : 'destructive'} className={isUnder200 ? 'bg-emerald-600' : ''}>
                    {isUnder200 ? 'INAFECTO' : 'AFECTO A IMPUESTOS'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {isUnder200
                    ? '🟢 Exonerado de aranceles e IGV. Totalmente seguro para declarar ante Aduanas.'
                    : '🔴 Supera $200 USD: Paga 4% Arancel + 18% IGV + 10% Percepción. Puedes reasignar un producto al otro perfil.'}
                </p>
              </CardContent>
            </Card>

            {/* Summary Count Card */}
            <Card className="border-l-4 border-l-purple-500">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Paquetes Asignados</CardTitle>
                  <Package className="h-4 w-4 text-purple-500" />
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-2xl font-black">{selectedProfileItems.length} <span className="text-xs font-normal text-muted-foreground">de {profileItems.length} paquetes</span></div>
                <p className="text-xs text-muted-foreground">
                  Valor en Soles: <span className="font-semibold text-foreground">S/ {(totalFobUsd * 3.40).toFixed(2)} PEN</span> (T.C. 3.40)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* 4. Action Buttons Row */}
          <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-4 shadow-sm">
            <span className="text-sm font-semibold text-muted-foreground mr-2">Descargas ({currentProfile.name.split(' ')[0]}):</span>
            <Button
              variant="outline"
              onClick={handleDownloadEmbarque}
              disabled={downloadingType === 'embarque' || !selectedProfileItems.length}
              className="gap-2 border-emerald-600/40 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 font-medium text-xs h-9"
            >
              {downloadingType === 'embarque' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
              1. Hoja de Embarque (.xlsx)
            </Button>

            <Button
              variant="outline"
              onClick={handleDownloadTraduccion}
              disabled={downloadingType === 'traduccion' || !selectedProfileItems.length}
              className="gap-2 border-blue-600/40 hover:bg-blue-50 dark:hover:bg-blue-950/30 font-medium text-xs h-9"
            >
              {downloadingType === 'traduccion' ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 text-blue-600" />}
              2. Hoja de Traducción (.xlsx)
            </Button>

            <Button
              variant="outline"
              onClick={handleDownloadFichaRuc}
              className="gap-2 border-orange-600/40 hover:bg-orange-50 dark:hover:bg-orange-950/30 font-medium text-xs h-9"
            >
              <FileText className="h-4 w-4 text-orange-600" />
              3. Ficha RUC (PDF)
            </Button>

            <div className="ml-auto flex items-center gap-2">
              <Input
                placeholder="N° Guía AWB (opcional)"
                value={awb}
                onChange={(e) => setAwb(e.target.value)}
                className="w-40 text-xs h-9 font-mono"
              />
              <Button variant="secondary" size="sm" onClick={addNewItem} className="gap-1 h-9 text-xs">
                <Plus className="h-4 w-4" /> Agregar Ítem
              </Button>
            </div>
          </div>

          {/* 5. Main Table: Editable Shipment Items with Importer Assignment */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Paquetes para el Embarque ({currentProfile.name})</CardTitle>
                  <CardDescription>
                    Selecciona los paquetes confirmados en el almacén de Miami para conformar el vuelo respetando el tope de $200 USD.
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant={filterDeliveredMiamiOnly ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setFilterDeliveredMiamiOnly(!filterDeliveredMiamiOnly)}
                    className={`text-xs h-8 gap-1.5 ${filterDeliveredMiamiOnly ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {filterDeliveredMiamiOnly ? 'Mostrando: Solo en Almacén Miami' : 'Filtrar: Solo en Almacén Miami'}
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSelectAll(selectedProfileItems.length !== profileItems.length)}
                    className="text-xs h-8"
                  >
                    {selectedProfileItems.length === profileItems.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/50 text-muted-foreground font-semibold text-left">
                      <th className="p-3 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={profileItems.length > 0 && selectedProfileItems.length === profileItems.length}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                      </th>
                      <th className="p-3 min-w-[130px]">Comprador / RUC</th>
                      <th className="p-3 min-w-[140px]">Courier / Tracking USA</th>
                      <th className="p-3 min-w-[210px]">Contenido General (eBay)</th>
                      <th className="p-3 min-w-[150px]">Nombre Técnico SUNAT</th>
                      <th className="p-3 min-w-[90px]">Marca</th>
                      <th className="p-3 min-w-[130px]">Modelo Exacto</th>
                      <th className="p-3 min-w-[85px]">Estado</th>
                      <th className="p-3 min-w-[110px]">N° Orden eBay</th>
                      <th className="p-3 min-w-[85px] text-right">Valor USD</th>
                      <th className="p-3 w-10 text-center">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {profileItems.map((item) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-muted/30 transition-colors ${item.selected ? 'bg-emerald-50/10' : 'opacity-60'}`}
                      >
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={item.selected}
                            onChange={() => toggleItem(item.id)}
                            className="rounded border-gray-300 h-4 w-4"
                          />
                        </td>
                        <td className="p-3">
                          <div className="space-y-1">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-bold block truncate max-w-[125px] text-center ${
                                item.assignedProfile === 'fabio'
                                  ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                                  : 'border-purple-500 bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300'
                              }`}
                            >
                              {item.assignedProfile === 'fabio' ? 'RUC: 10762026835' : `RUC: ${peggyRuc}`}
                            </Badge>
                            <select
                              value={item.assignedProfile}
                              onChange={(e) => updateItem(item.id, 'assignedProfile', e.target.value as ProfileKey)}
                              className="h-7 w-full rounded border bg-background px-1 text-xs font-bold text-primary"
                            >
                              <option value="fabio">👤 SHIPER FABIO</option>
                              <option value="peggy">👤 SHIPER PEGGY</option>
                            </select>
                          </div>
                        </td>
                        <td className="p-3 space-y-1">
                          <div className="flex items-center gap-1">
                            <select
                              value={item.courier}
                              onChange={(e) => updateItem(item.id, 'courier', e.target.value)}
                              className="h-7 rounded border bg-background px-1 text-xs font-semibold"
                            >
                              <option value="UPS">UPS</option>
                              <option value="USPS">USPS</option>
                              <option value="FEDEX">FEDEX</option>
                              <option value="DHL">DHL</option>
                            </select>
                            {item.status === 'USA' || item.isDeliveredInMiami ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800 shrink-0">
                                <Check className="h-2.5 w-2.5" /> En Miami
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-sky-700 dark:text-sky-400 bg-sky-50 dark:bg-sky-950/40 px-1.5 py-0.5 rounded border border-sky-200 dark:border-sky-800 shrink-0">
                                <Truck className="h-2.5 w-2.5" /> En Tránsito
                              </span>
                            )}
                          </div>
                          <Input
                            value={item.trackingUsa}
                            onChange={(e) => updateItem(item.id, 'trackingUsa', e.target.value)}
                            placeholder="Tracking USA"
                            className="h-7 text-xs font-mono"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            value={item.contenidoGeneral}
                            onChange={(e) => updateItem(item.id, 'contenidoGeneral', e.target.value)}
                            className="h-7 text-xs"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            value={item.productoNombre}
                            onChange={(e) => updateItem(item.id, 'productoNombre', e.target.value)}
                            placeholder="Ej. Tableta Electrónica"
                            className="h-7 text-xs"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            value={item.marca}
                            onChange={(e) => updateItem(item.id, 'marca', e.target.value)}
                            placeholder="Apple"
                            className="h-7 text-xs"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            value={item.modelo}
                            onChange={(e) => updateItem(item.id, 'modelo', e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase())}
                            onBlur={() => updateItem(item.id, 'modelo', sanitizeSunatModel(item.modelo))}
                            placeholder="A1701"
                            title="Código técnico SUNAT (ej. A1701). Sin palabras como iPad o Pro."
                            className="h-7 text-xs font-mono font-semibold text-blue-600 dark:text-blue-400"
                          />
                        </td>
                        <td className="p-3">
                          <select
                            value={item.estado}
                            onChange={(e) => updateItem(item.id, 'estado', e.target.value)}
                            className="h-7 rounded border bg-background px-1 text-xs"
                          >
                            <option value="Usado">Usado</option>
                            <option value="Nuevo">Nuevo</option>
                            <option value="Reacondicionado">Reacondicionado</option>
                          </select>
                        </td>
                        <td className="p-3">
                          <Input
                            value={item.numeroFactura}
                            onChange={(e) => updateItem(item.id, 'numeroFactura', e.target.value)}
                            placeholder="22-15116-16018"
                            className="h-7 text-xs font-mono"
                          />
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.valorUsd}
                              onChange={(e) => updateItem(item.id, 'valorUsd', parseFloat(e.target.value) || 0)}
                              className="h-7 w-16 text-right text-xs font-bold"
                            />
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(item.id)}
                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* 6. Exact Gmail Pre-Alerta Generator with Direct Gmail Open */}
          <Card className="border-t-4 border-t-emerald-600 shadow-md">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <MailIcon className="h-6 w-6 text-emerald-600" />
                  <div>
                    <CardTitle className="text-base">Pre-Alerta de Correo Oficial para Shipper</CardTitle>
                    <CardDescription>
                      Formato idéntico a tu plantilla de Gmail. Incluye destinatarios, fecha de vuelo ({selectedFlight?.labelLong}) y nombre del importador ({currentProfile.name}).
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {/* Direct Open in Gmail Button */}
                  <a
                    href={openInGmailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center rounded-md text-xs font-semibold bg-red-600 hover:bg-red-700 text-white px-3.5 py-2 shadow transition-colors gap-2"
                  >
                    <Send className="h-3.5 w-3.5" />
                    Abrir Directamente en Gmail 🚀
                  </a>

                  {/* Register in Bitácora Button */}
                  <Button
                    onClick={handleRegisterShipment}
                    disabled={registeringShipment || !selectedProfileItems.length}
                    className="text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 shadow transition-colors gap-2"
                  >
                    {registeringShipment ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plane className="h-3.5 w-3.5" />}
                    Guardar en Bitácora
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Recipients Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-md border bg-muted/30">
                  <span className="font-bold text-muted-foreground block mb-0.5">Para:</span>
                  <span className="font-mono text-foreground font-semibold">{emailTo}</span>
                </div>
                <div className="p-2.5 rounded-md border bg-muted/30">
                  <span className="font-bold text-muted-foreground block mb-0.5">CC (Copia):</span>
                  <span className="font-mono text-foreground font-semibold">{emailCc}</span>
                </div>
              </div>

              {/* Subject Row */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>Asunto del Correo (Formato Exacto Shipper):</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(emailSubject, true)}
                    className="h-6 text-xs gap-1 text-emerald-600 hover:text-emerald-700"
                  >
                    {copiedSubject ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedSubject ? '¡Copiado!' : 'Copiar Asunto'}
                  </Button>
                </div>
                <div className="rounded-md bg-muted p-2.5 font-mono text-sm font-bold text-foreground select-all border">
                  {emailSubject}
                </div>
              </div>

              {/* Body Row */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                  <span>Cuerpo del Mensaje:</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(emailBody, false)}
                    className="h-6 text-xs gap-1 text-emerald-600 hover:text-emerald-700"
                  >
                    {copiedBody ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copiedBody ? '¡Copiado!' : 'Copiar Cuerpo del Mensaje'}
                  </Button>
                </div>
                <pre className="rounded-md bg-muted p-4 font-mono text-xs text-foreground whitespace-pre-wrap select-all leading-relaxed border">
                  {emailBody}
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MailIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
