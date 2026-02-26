import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { HttpClientModule } from '@angular/common/http';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { NgxEchartsModule } from 'ngx-echarts';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';


import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { TimeSeriesChartComponent } from './components/time-series-chart/time-series-chart.component';
import { DataService } from './services/data.service';
import { MockDataService } from './services/mock-data.service';
import { environment } from '../environments/environment';

@NgModule({
  declarations: [
    AppComponent,
    TimeSeriesChartComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    HttpClientModule,
    FormsModule,
    ReactiveFormsModule,
    AppRoutingModule,
    NgxEchartsModule.forRoot({
      echarts: () => import('echarts')
    }),
    MatToolbarModule,
    MatCardModule,
    MatSelectModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatIconModule,
    MatTooltipModule
  ],
  providers: [
    {
      provide: DataService,
      useClass: environment.useMock ? MockDataService : DataService
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
