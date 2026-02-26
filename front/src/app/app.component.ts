import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormControl } from '@angular/forms';
import { DataService, Ensayo, Channel, DataPoint, DataStats, DataResponse } from './services/data.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  title = 'Industrial Data Visualization';

  // Data
  ensayos: Ensayo[] = [];
  deviceNames: string[] = [];
  channels: Map<string, Channel[]> = new Map<string, Channel[]>();
  overviewData: DataPoint[] = [];
  detailData: DataPoint[] = [];
  stats: DataStats | null = null;
  dataMetadata: any = null;

  // Time range for zoom functionality
  currentTimeRange: { start?: Date; end?: Date } = {};

  // Form controls
  selectedEnsayo = new FormControl('');
  selectedTable = new FormControl('');
  selectedChannels = new FormControl<string[]>([]);

  // Variables para ngModel
  selectedTableValue = '';
  selectedEnsayoValue = '';
  selectedChannelsValue: string[] = [];

  // Available tables
  availableTables = [
    { value: 'fuente_valores', label: 'Fuente de Alimentación' },
    { value: 'camara_valores', label: 'Cámara Climática' },
    { value: 'motor_valores', label: 'Motor Inteligente' }
  ];

  // Loading states
  loading = false;
  loadingChannels = false;
  loadingData = false;

  constructor(private dataService: DataService, private cdr: ChangeDetectorRef) { }

  ngOnInit(): void {
    this.loadEnsayos();

    // Inicializar valores por defecto
    this.selectedChannelsValue = [];
    this.selectedChannels.setValue([]);

    // Cargar canales de la tabla por defecto
    this.loadChannels();
  }

  // Métodos para manejar eventos de select estándar
  onDeviceReload(event: any): void {
    this.loadChannels();

  }

  onEnsayoChange(event: any): void {
    const ensayo = event.target.value;
    this.selectedEnsayoValue = ensayo;
    this.selectedEnsayo.setValue(ensayo);
    this.loadData();
  }

  onChannelsChange(event: any): void {
    // Extract only the pure column_name from each selected option
    const selectedOptions = Array.from(event.target.selectedOptions).map((option: any) => {
      // If value is like "1: 'temperatura_actual'", extract only the part inside quotes
      const match = option.value.match(/'([^']+)'/);
      if (match) {
        return match[1];
      }
      // If value is already pure, use as is
      return option.value;
    });
    this.selectedChannelsValue = selectedOptions;
    this.selectedChannels.setValue(selectedOptions);
    this.loadData();
  }

  private loadEnsayos(): void {
    console.log('Loading ensayos...');
    this.loading = true;
    this.dataService.getEnsayos().subscribe({
      next: (ensayos) => {
        console.log('Ensayos loaded:', ensayos);
        this.ensayos = ensayos;
        this.loading = false;
      },
      error: (error) => {
        console.error('Error loading ensayos:', error);
        this.loading = false;
      }
    });
  }

  private loadChannels(): void {
    this.loadingChannels = true;
    this.selectedChannelsValue = [];
    this.selectedChannels.setValue([]);
    this.channels = new Map<string, Channel[]>();

    this.dataService.getAllChannels().subscribe({
      next: (channels) => {
        console.log('Channels received from backend:', channels);
        this.channels = channels;
        this.deviceNames = Array.from(channels.keys());
        this.loadingChannels = false;
      },
      error: (error) => {
        console.error('Error loading channels:', error);
        this.loadingChannels = false;
      }
    });
  }

  // Carga inicial: panorámica y detalle
  private loadData(): void {
    const ensayo = this.selectedEnsayo.value;
    let channels = this.selectedChannels.value || [];
    const channelsMap = new Map<string, string[]>();
    if (Array.isArray(channels)) {
      // Agrupar los canales seleccionados por device
      channels.forEach(c => {
        const cleanChannel = typeof c === 'string' ? c.replace(/[^a-zA-Z0-9_]/g, '') : c;
        // Buscar a qué device pertenece este canal
        let foundDevice = null;
        for (const device of this.deviceNames) {
          const deviceChannels = this.channels.get(device) || [];
          if (deviceChannels.some(ch => ch.column_name === cleanChannel)) {
            foundDevice = device;
            break;
          }
        }
        if (foundDevice) {
          if (!channelsMap.has(foundDevice)) {
            channelsMap.set(foundDevice, []);
          }
          channelsMap.get(foundDevice)!.push(cleanChannel);
        }
      });
    }
    if (!ensayo || channels.length === 0) {
      this.overviewData = [];
      this.detailData = [];
      this.stats = null;
      this.dataMetadata = null;
      console.log('[loadData] Sin ensayo o canales seleccionados.');
      return;
    }
    this.loadingData = true;
    const maxPoints = 10000;
    // LOG: Mostrar el channelsMap construido
    console.log('[loadData] ensayo:', ensayo);
    for (const [device, chans] of channelsMap.entries()) {
      console.log(`[loadData] Device: ${device}, Channels:`, chans);
    }


    this.fetchDevicesData(channelsMap, ensayo, maxPoints)
      .then((responses) => {
        const allData = responses.filter((r): r is DataResponse => r !== undefined).flatMap(r => r.data || []);
        allData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        this.overviewData = allData;
        this.detailData = allData;
        this.dataMetadata = responses.find(r => r !== undefined)?.metadata || null;
        this.loadingData = false;
        console.log('MetaData (init):', this.dataMetadata);
      })
      .catch((error) => {
        console.error('Error loading data:', error);
        this.overviewData = [];
        this.detailData = [];
        this.loadingData = false;
      });
  }


  private async fetchDevicesData(channelsMap: Map<string, string[]>, ensayo: string, maxPoints: number): Promise<DataResponse[]> {
    // Hacer una petición por cada device y combinar los datos usando Promise.all
    const promises = Array.from(channelsMap.entries()).map(([device, chans]) =>
      this.dataService.getData(device, ensayo, chans, undefined, undefined, maxPoints).toPromise()
    );
    const results = await Promise.all(promises);
    // Filtrar cualquier undefined por seguridad
    return results.filter((r): r is DataResponse => r !== undefined);
  }

  onRefreshData(): void {
    this.loadData();
  }

  onClearSelection(): void {
    this.selectedChannelsValue = [];
    this.selectedChannels.setValue([]);
  }

  onZoomChanged(timeRange: { start: string; end: string }): void {
    this.currentTimeRange = {
      start: new Date(timeRange.start),
      end: new Date(timeRange.end)
    };
    console.log('[ZoomChanged] Rango:', timeRange.start, timeRange.end);
    // Recarga el detalle usando fetchDevicesData para soportar múltiples devices
    const ensayo = this.selectedEnsayo.value;
    let channels = this.selectedChannels.value || [];
    const channelsMap = new Map<string, string[]>();
    if (Array.isArray(channels)) {
      channels.forEach(c => {
        const cleanChannel = typeof c === 'string' ? c.replace(/[^a-zA-Z0-9_]/g, '') : c;
        let foundDevice = null;
        for (const device of this.deviceNames) {
          const deviceChannels = this.channels.get(device) || [];
          if (deviceChannels.some(ch => ch.column_name === cleanChannel)) {
            foundDevice = device;
            break;
          }
        }
        if (foundDevice) {
          if (!channelsMap.has(foundDevice)) {
            channelsMap.set(foundDevice, []);
          }
          channelsMap.get(foundDevice)!.push(cleanChannel);
        }
      });
    }
    if (!ensayo || channels.length === 0) {
      this.detailData = [];
      return;
    }
    this.loadingData = true;
    const maxPoints = 10000;
    this.fetchDevicesData(channelsMap, ensayo, maxPoints)
      .then((responses) => {
        // Filtrar por rango de tiempo
        let allData = responses.filter((r): r is DataResponse => r !== undefined).flatMap(r => r.data || []);
        allData = allData.filter(dp => {
          const ts = new Date(dp.timestamp).getTime();
          return ts >= new Date(timeRange.start).getTime() && ts <= new Date(timeRange.end).getTime();
        });
        allData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        this.detailData = allData;
        this.dataMetadata = responses.find(r => r !== undefined)?.metadata || null;
        console.log('MetaData (zoom):', this.dataMetadata);
        this.loadingData = false;
        this.cdr.detectChanges();
      })
      .catch((error) => {
        console.error('Error loading detail data:', error);
        this.detailData = [];
        this.loadingData = false;
        this.cdr.detectChanges();
      });
  }

  getSelectedChannelsList(): string[] {
    return this.selectedChannelsValue || [];
  }

  // Maneja el cambio de selección de un canal (checkbox)
  onChannelCheckboxChange(columnName: string, event: any): void {
    if (event.target.checked) {
      // Añadir canal si no está
      if (!this.selectedChannelsValue.includes(columnName)) {
        this.selectedChannelsValue = [...this.selectedChannelsValue, columnName];
      }
    } else {
      // Quitar canal si está
      this.selectedChannelsValue = this.selectedChannelsValue.filter(c => c !== columnName);
    }
    this.selectedChannels.setValue(this.selectedChannelsValue);
    this.loadData();
  }

  // Recarga la panorámica con los datos originales (diezmado global)
  onReloadOverview(): void {
    const ensayo = this.selectedEnsayo.value;
    const table = this.selectedTable.value;
    let channels = this.selectedChannels.value || [];
    if (Array.isArray(channels)) {
      channels = channels.map(c => typeof c === 'string' ? c.replace(/[^a-zA-Z0-9_]/g, '') : c);
    }
    if (!ensayo || !table || channels.length === 0) {
      this.overviewData = [];
      return;
    }
    this.loadingData = true;
    const maxPoints = 10000;
    // Llama solo para la panorámica (rango completo)
    this.dataService.getData(table, ensayo, channels, undefined, undefined, maxPoints).subscribe({
      next: (response) => {
        this.overviewData = response.data || [];
        this.dataMetadata = response.metadata ? { ...response.metadata } : null;
        this.loadingData = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading overview data:', error);
        this.overviewData = [];
        this.loadingData = false;
      }
    });
  }
}
