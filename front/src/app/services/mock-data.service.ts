import { of } from 'rxjs';
import { DataService, Ensayo, Channel, DataResponse, DataStats } from './data.service';

export class MockDataService {
    getEnsayos() {
        const ensayos: Ensayo[] = [
            { codigo_ensayo: 'senoidal', descripcion: 'Señal senoidal' },
            { codigo_ensayo: 'recta', descripcion: 'Señal recta' }
        ];
        return of(ensayos);
    }

    getChannels(table: string) {
        const channels: Channel[] = [
            { column_name: 'temp', display_name: 'Temperatura', unit: '°C' },
            { column_name: 'hum', display_name: 'Humedad', unit: '%' },
            { column_name: 'pres', display_name: 'Presión', unit: 'hPa' }
        ];
        return of(channels);
    }

    getData(table: string, ensayo: string, channels: string[], startTime?: string, endTime?: string, maxPoints?: number, zoomLevel?: number) {
        let data: any[] = [];
        if (ensayo === 'senoidal') {
            for (let h = 0; h < 6; h++) {
                for (let i = 0; i < 100; i++) {
                    const date = new Date(2024, 0, 1, h, 0, i * 36);
                    const point: any = { timestamp: date.toISOString() };
                    if (!channels || channels.includes('temp')) {
                        point['temp'] = 20 + 5 * Math.sin(i * 2 * Math.PI / 100);
                    }
                    if (!channels || channels.includes('hum')) {
                        point['hum'] = 50 + 10 * Math.cos(i * 2 * Math.PI / 100);
                    }
                    if (!channels || channels.includes('pres')) {
                        point['pres'] = 1013 + 2 * Math.sin(i * 2 * Math.PI / 50);
                    }
                    data.push(point);
                }
            }
        } else if (ensayo === 'recta') {
            for (let i = 0; i < 100; i++) {
                const date = new Date(2024, 0, 1, 0, 0, i);
                const point: any = { timestamp: date.toISOString() };
                if (!channels || channels.includes('temp')) {
                    point['temp'] = 20 + i * 0.1;
                }
                if (!channels || channels.includes('hum')) {
                    point['hum'] = 50 + i * 0.2;
                }
                if (!channels || channels.includes('pres')) {
                    point['pres'] = 1013 + i * 0.05;
                }
                data.push(point);
            }
        }

        // Filtrar por startTime y endTime si están presentes
        if (startTime) {
            const start = new Date(startTime).getTime();
            data = data.filter(d => new Date(d.timestamp).getTime() >= start);
        }
        if (endTime) {
            const end = new Date(endTime).getTime();
            data = data.filter(d => new Date(d.timestamp).getTime() <= end);
        }

        const response: DataResponse = {
            data,
            metadata: {
                totalPoints: data.length,
                returnedPoints: data.length,
                samplingRate: 1,
                timeRange: {
                    start: data[0]?.timestamp,
                    end: data[data.length - 1]?.timestamp
                }
            }
        };
        return of(response);
    }

    getStats(table: string, ensayo: string) {
        const stats: DataStats = {
            total_records: 100,
            start_time: new Date(2024, 0, 1, 0, 0, 0).toISOString(),
            end_time: new Date(2024, 0, 1, 0, 1, 39).toISOString(),
            duration_hours: 0.0275
        };
        return of(stats);
    }

    getHealth() {
        return of({ status: 'ok' });
    }
}
