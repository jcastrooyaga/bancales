export type Cliente = 'MICHELIN' | 'CONTINENTAL';
export type TipoEvento = 'CNTI' | 'CNTO' | 'CNTS';
export type FuenteEvento = 'IMPORTACION' | 'MANUAL';
export type Pais = 'ES' | 'PT';

export interface Plataforma {
  id: string;
  codigo: string;
  nombre: string;
  pais: Pais;
  activa: boolean;
  createdAt: string;
}

export interface Bancal {
  id: string;
  codigo: string;
  cliente: Cliente;
  plataformaActual?: { codigo: string; nombre: string } | null;
  ultimaLectura: string | null;
  diasSinLectura: number | null;
  enRiesgo: boolean;
}

export interface Evento {
  id: string;
  bancalId: string;
  plataformaId: string;
  tipo: TipoEvento;
  lectura: string;
  usuario: string;
  fuente: FuenteEvento;
  createdAt: string;
  plataforma?: { codigo: string; nombre: string };
}

export interface FilaPlataforma {
  plataforma: { id: string; codigo: string; nombre: string; pais: Pais };
  invReal: number;
  invTeorico: number;
  desviacion: number;
  prevReal: number;
  cntiCount: number;
  cntoCount: number;
  bancalesRiesgo: number;
}

export interface DashboardData {
  semana: string;
  year: number;
  kpis: {
    totalEnCircuito: number;
    totalMichelin: number;
    totalContinental: number;
    totalRiesgo: number;
    plataformasDesviacion: number;
  };
  plataformas: FilaPlataforma[];
}

export interface WeekId {
  year: number;
  week: number;
}

export interface ImportResult {
  importados: number;
  duplicados: number;
  errores: { fila: number; motivo: string }[];
}

export interface MovimientoItem {
  codigo: string;
  cliente: string;
  lectura: string;
}

export interface ResumenSemana {
  invRealAnterior: number;
  cntiCount: number;
  cntoCount: number;
  invTeorico: number;
  invReal: number;
  desviacion: number;
  invRealAnteriorDetalle: MovimientoItem[];
  cntiDetalle: MovimientoItem[];
  cntoDetalle: MovimientoItem[];
  invRealDetalle: MovimientoItem[];
}

export interface BancalSimple {
  id: string;
  codigo: string;
  cliente: Cliente;
  ultimaLectura: string | null;
  ultimoTipo?: TipoEvento | null;
}

export interface HistoricoItem {
  id: string;
  fecha: string;
  codigo: string;
  cliente: Cliente;
  evento: TipoEvento;
  usuario: string;
  plataforma: string;
  plataformaNombre: string;
}

export interface BancalDescuadre extends BancalSimple {
  motivo: 'ANTERIOR' | 'ENTRADA';
}

export interface DetalleData {
  plataforma: Plataforma;
  historico: { semana: string; year: number; prevReal: number; cnti: number; cnto: number; teorico: number; real: number; desviacion: number }[];
  resumenSemana: ResumenSemana;
  bancalesEnPlataforma: BancalSimple[];
  sobrantes: BancalSimple[];
  descuadre: BancalDescuadre[];
  bancalesRiesgo: BancalSimple[];
  umbral: number;
}
