import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { EChartsOption } from 'echarts';
import { DataPoint, Channel } from '../../services/data.service';
import { DataService } from '../../services/data.service';

@Component({
  selector: 'app-time-series-chart',
  templateUrl: './time-series-chart.component.html',
  styleUrls: ['./time-series-chart.component.scss']
})
export class TimeSeriesChartComponent implements OnChanges {
  // Botón: copiar los datos actuales de detalle en la panorámica
  copyDetailToOverview(): void {
    this.overviewData = [...this.detailData];
    this.updateOverviewChart();
  }

  // Output event to request overview reload from parent
  @Output() reloadOverview = new EventEmitter<void>();

  // Botón: restablecer la panorámica con todos los datos originales
  resetOverview(): void {
    this.reloadOverview.emit();
    if (this.chartInstance) {
      this.chartInstance.setOption({
        dataZoom: [{ type: 'slider', start: 0, end: 100 }]
      });
    }
  }
  private dataZoomTimeout: any = null;
  private chartInstance: any = null;
  private resizeObserver: ResizeObserver | null = null;
  @Output() zoomChanged = new EventEmitter<{ start: string; end: string }>();

  ngAfterViewInit(): void {
    const chartContainer = document.querySelector('.chart-container');
    if (chartContainer) {
      this.resizeObserver = new ResizeObserver(() => {
        if (this.chartInstance) {
          this.chartInstance.resize();
        }
      });
      this.resizeObserver.observe(chartContainer);
    }
  }

  ngOnDestroy(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
  }
  @Input() overviewData: DataPoint[] = [];
  @Input() detailData: DataPoint[] = [];
  @Input() channels: Channel[] = [];
  @Input() selectedChannels: string[] = [];
  @Input() title: string = 'Time Series Chart';

  detailChartOption: EChartsOption = {};
  overviewChartOption: EChartsOption = {};

  ngOnChanges(changes: SimpleChanges): void {
    // Redibuja la gráfica de detalle si cambia detailData
    if (changes['detailData'] && !changes['detailData'].firstChange) {
      this.updateDetailChart();
      return;
    }
    // Redibuja la panorámica si cambia overviewData o canales
    if (changes['overviewData'] || changes['selectedChannels'] || changes['channels'] || changes['detailData']?.firstChange) {
      this.updateOverviewChart();
      this.updateDetailChart();
    }
  }

  private updateDetailChart(): void {
    if (!this.detailData.length || !this.selectedChannels.length) {
      this.detailChartOption = {};
      return;
    }
    // Agrupa canales por unidad para ejes Y dinámicos
    const unitGroups: { [unit: string]: Channel[] } = {};
    this.selectedChannels.forEach(channelName => {
      const channel = this.channels.find(c => c.column_name === channelName);
      if (channel) {
        const unit = channel.unit || 'default';
        if (!unitGroups[unit]) unitGroups[unit] = [];
        unitGroups[unit].push(channel);
      }
    });
    const yAxis: any[] = [];
    const units = Object.keys(unitGroups);
    units.forEach((unit, index) => {
      yAxis.push({
        type: 'value',
        name: unit,
        position: index % 2 === 0 ? 'left' : 'right',
        offset: Math.floor(index / 2) * 60,
        axisLabel: { formatter: `{value} ${unit}` },
        axisLine: { show: true, lineStyle: { color: this.getColorByIndex(index) } }
      });
    });
    const series: any[] = [];
    this.selectedChannels.forEach((channelName, index) => {
      const channel = this.channels.find(c => c.column_name === channelName);
      if (!channel) return;
      const yAxisIndex = units.indexOf(channel.unit || 'default');
      const detailSeriesData = this.detailData.map(point => [new Date(point.timestamp).getTime(), point[channelName]]);
      series.push({
        name: channel.display_name,
        type: 'line',
        data: detailSeriesData,
        yAxisIndex: yAxisIndex,
        symbol: 'none',
        symbolSize: 4,
        lineStyle: { width: 2, color: this.getColorByIndex(index) },
        smooth: true
      });
    });
    this.detailChartOption = {
      title: { text: this.title, left: 'center' },
      legend: {
        data: this.selectedChannels.map((channelName, index) => {
          const channel = this.channels.find(c => c.column_name === channelName);
          return channel ? channel.display_name : channelName;
        }),
        top: 40,
        left: 'center',
        orient: 'horizontal',
        icon: 'circle',
        show: true
      },
      xAxis: { type: 'time' },
      yAxis: yAxis,
      series: series,
      tooltip: { trigger: 'axis' }
    };
  }

  private updateOverviewChart(): void {
    if (!this.overviewData.length || !this.selectedChannels.length) {
      this.overviewChartOption = {};
      return;
    }
      // Configuración de ejes igual que la superior pero ocultos
      const unitGroups: { [unit: string]: Channel[] } = {};
      this.selectedChannels.forEach(channelName => {
        const channel = this.channels.find(c => c.column_name === channelName);
        if (channel) {
          const unit = channel.unit || 'default';
          if (!unitGroups[unit]) unitGroups[unit] = [];
          unitGroups[unit].push(channel);
        }
      });
      const yAxis: any[] = [];
      const units = Object.keys(unitGroups);
      units.forEach((unit, index) => {
        yAxis.push({
          type: 'value',
          position: index % 2 === 0 ? 'left' : 'right',
          offset: Math.floor(index / 2) * 60,
          axisLabel: { show: false },
          axisLine: { show: false },
          splitLine: { show: false }
        });
      });
      const series: any[] = [];
      this.selectedChannels.forEach((channelName, index) => {
        const channel = this.channels.find(c => c.column_name === channelName);
        if (!channel) return;
        const yAxisIndex = units.indexOf(channel.unit || 'default');
        const overviewSeriesData = this.overviewData.map(point => [new Date(point.timestamp).getTime(), point[channelName]]);
        series.push({
          name: channel.display_name + ' (pano)',
          type: 'line',
          data: overviewSeriesData,
          yAxisIndex: yAxisIndex,
          symbol: 'none',
          lineStyle: { width: 2, color: this.getColorByIndex(index) },
          smooth: true,
          showSymbol: false,
          emphasis: { disabled: true },
          tooltip: { show: false }
        });
      });
      this.overviewChartOption = {
        grid: { left: '10%', right: '10%', top: 0, height: '100%', backgroundColor: '#f5f5f5' },
        xAxis: { type: 'time', axisLine: { show: false }, axisLabel: { show: false }, splitLine: { show: false } },
        yAxis: yAxis,
        series: series,
        legend: { show: false },
        dataZoom: [
          {
            type: 'slider',
            xAxisIndex: 0,
            start: 0,
            end: 100,
            bottom: 10
          }
        ],
        tooltip: { show: false }
      };
  }

  onChartInit(ec: any): void {
    this.chartInstance = ec;
    this.reattachDataZoomListener();
  }

  private reattachDataZoomListener(): void {
    if (!this.chartInstance) return;
    this.chartInstance.on('dataZoom', () => {
      if (this.dataZoomTimeout) {
        clearTimeout(this.dataZoomTimeout);
      }
      this.dataZoomTimeout = setTimeout(() => {
        const option = this.chartInstance.getOption();
        // Obtener los valores x visibles en la serie de la panorámica
        // Obtener el rango mostrado en la panorámica según el slider
        const dz = option.dataZoom?.[0];
        let panoSeries = this.overviewChartOption.series;
        if (Array.isArray(panoSeries) && panoSeries.length > 0 && dz) {
          // Asegurar que data es un array
          const panoData = Array.isArray(panoSeries[0].data) ? panoSeries[0].data : [];
          const startIdx = dz.start != null ? Math.floor(panoData.length * dz.start / 100) : 0;
          const endIdx = dz.end != null ? Math.ceil(panoData.length * dz.end / 100) : panoData.length - 1;
          // Unir todos los x de todas las series, pero solo en el rango
          const xValues = panoSeries.flatMap((serie: any) =>
            Array.isArray(serie.data)
              ? serie.data.slice(startIdx, endIdx + 1).map((d: any) => Array.isArray(d) ? d[0] : d)
              : []
          );
          if (xValues.length > 0) {
            const minX = Math.min(...xValues);
            const maxX = Math.max(...xValues);
            this.zoomChanged.emit({
              start: new Date(minX).toISOString(),
              end: new Date(maxX).toISOString()
            });
          }
        }
      }, 200);
    });
  }

  private getColorByIndex(index: number): string {
    const colors = [
      '#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de',
      '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc', '#ff9f7f'
    ];
    return colors[index % colors.length];
  }
}
