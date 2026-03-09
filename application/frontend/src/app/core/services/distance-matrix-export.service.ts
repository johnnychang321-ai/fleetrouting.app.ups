import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Vehicle } from '../models/vehicle.model';
import { Shipment } from '../models/shipment.model';
import { FileService } from './file.service';

@Injectable({
  providedIn: 'root'
})
export class DistanceMatrixExportService {
  private readonly API_URL = 'https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix';

  constructor(private fileService: FileService) {}

  async exportDistanceMatrix(
    vehicles: any[], 
    shipments: any[],
    apiKey: string
  ): Promise<void> {
    const origins: any[] = [];
    const destinations: any[] = [];

    // 1. Vehicles: start locations as origins
    vehicles.forEach(vehicle => {
      const latLng = vehicle.startWaypoint?.location?.latLng;
      if (latLng) {
        origins.push({
          waypoint: { location: { latLng } },
          routeModifiers: { avoidTolls: false }
        });
      }
    });

    // 2. Shipments: pickups as origins, deliveries as destinations
    shipments.forEach(shipment => {
      const pickupLatLng = shipment.pickups?.[0]?.arrivalWaypoint?.location?.latLng;
      if (pickupLatLng) {
        origins.push({
          waypoint: { location: { latLng: pickupLatLng } },
          routeModifiers: { avoidTolls: false }
        });
      }

      const deliveryLatLng = shipment.deliveries?.[0]?.arrivalWaypoint?.location?.latLng;
      if (deliveryLatLng) {
        destinations.push({
          waypoint: { location: { latLng: deliveryLatLng } }
        });
      }
    });

    // Need at least 1 origin and 1 destination to make a valid Distance Matrix request
    if (origins.length === 0 || destinations.length === 0) {
      alert('Cannot compute distance matrix. Missing required origins (vehicles or shipments) or destinations (shipments). Please add them to the map before clicking "get DM".');
      return;
    }

    const payload = {
      origins,
      destinations,
      travelMode: 'DRIVE',
      routingPreference: 'ROUTING_PREFERENCE_UNSPECIFIED'
    };

    try {
      const response = await fetch(this.API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,status'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        console.error('API Error', await response.text());
        throw new Error('Distance Matrix API request failed');
      }

      const data = await response.json();
      
      const filesToZip = {
        'request.json': JSON.stringify(payload, null, 2),
        'response.json': JSON.stringify(data, null, 2)
      };

      const zipBlob = await this.fileService.zip(filesToZip).toPromise();
      if (zipBlob) {
        this.fileService.download(`distance-matrix-${new Date().getTime()}.zip`, [zipBlob], 'application/zip');
      }
    } catch (e) {
      console.error('Failed to export Distance Matrix', e);
    }
  }
}
