
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Ensayo {
  codigo_ensayo: string;
  descripcion: string;
}

export interface Channel {
  column_name: string;
  display_name: string;
  unit: string;
}

export interface DataPoint {
  timestamp: string;
  [key: string]: any;
}

export interface DataResponse {
  data: DataPoint[];
  metadata: {
    totalPoints: number;
    returnedPoints: number;
    samplingRate: number;
    timeRange: {
      start?: string;
      end?: string;
    };
  };
}

export interface DataStats {
  total_records: number;
  start_time: string;
  end_time: string;
  duration_hours: number;
}

@Injectable({
  providedIn: 'root'
})
export class DataService {
  private apiUrl = 'http://localhost:3001/api';

  constructor(private http: HttpClient) { }

  getEnsayos(): Observable<Ensayo[]> {
    return this.http.get<Ensayo[]>(`${this.apiUrl}/ensayos`);
  }

  getChannels(table: string): Observable<Channel[]> {
    return this.http.get<Channel[]>(`${this.apiUrl}/channels/${table}`);
  }


  getAllChannels(): Observable<Map<string, Channel[]>> {
    return this.http.get<{ [table: string]: Channel[] }>(`${this.apiUrl}/channels/all`).pipe(
      map(obj => {
        const result = new Map<string, Channel[]>();
        for (const key of Object.keys(obj)) {
          result.set(key, obj[key]);
        }
        return result;
      })
    );
  }
  getData(ensayo: string, channels: Map<string, string[]>, startTime?: string, endTime?: string, maxPoints?: number, zoomLevel?: number): Observable<DataResponse> {
    // Extraer el device (table) del primer key del Map
    const device = Array.from(channels.keys())[0];
    const channelList = channels.get(device) || [];
    let params = new HttpParams()
      .set('ensayo', ensayo)
      .set('channels', channelList.join(','));

    if (startTime) params = params.set('startTime', startTime);
    if (endTime) params = params.set('endTime', endTime);
    if (maxPoints) params = params.set('maxPoints', maxPoints.toString());
    if (zoomLevel) params = params.set('zoomLevel', zoomLevel.toString());

    return this.http.get<DataResponse>(`${this.apiUrl}/data/${device}`, { params });
  }

  getStats(table: string, ensayo: string): Observable<DataStats> {
    const params = new HttpParams().set('ensayo', ensayo);
    return this.http.get<DataStats>(`${this.apiUrl}/stats/${table}`, { params });
  }

  getHealth(): Observable<any> {
    return this.http.get(`${this.apiUrl}/health`);
  }
}
