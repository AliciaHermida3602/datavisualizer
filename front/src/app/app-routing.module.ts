import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { TimeSeriesChartComponent } from './components/time-series-chart/time-series-chart.component';

const routes: Routes = [
  { path: '', component: TimeSeriesChartComponent },
  { path: '**', redirectTo: '' }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
