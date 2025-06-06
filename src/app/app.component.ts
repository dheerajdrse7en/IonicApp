import { Component, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';
import { PermissionService } from './services/permissions.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit {
  
  constructor(
    private platform: Platform,
    private permissionService: PermissionService
  ) {}

  async ngOnInit() {
    await this.platform.ready();
    await this.initializeApp();
  }

  private async initializeApp() {
    try {
      console.log('🚀 Initializing app...');
      
      if (this.platform.is('android')) {
        // Request all permissions on Android startup
        await this.permissionService.requestAllPermissions();
        
        // Get permission statuses
        const statuses = await this.permissionService.getAllPermissionStatuses();
        console.log('📊 Permission statuses:', statuses);
        
        // Test hardware functionality
        setTimeout(async () => {
          await this.testHardware();
        }, 2000);
      }
      
      console.log('✅ App initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing app:', error);
    }
  }

  private async testHardware(): Promise<void> {
    console.log('🔧 Testing hardware...');
    
    try {
      // Option 1: If testCamera and testMicrophone should return Promise<boolean>
      const cameraTest = await this.permissionService.testCamera();
      const micTest = await this.permissionService.testMicrophone();
      
      console.log('📱 Camera test:', cameraTest ? 'PASS' : 'FAIL');
      console.log('🎤 Microphone test:', micTest ? 'PASS' : 'FAIL');
    } catch (error) {
      console.error('❌ Hardware test error:', error);
      
      // Option 2: If the methods are void, just call them without awaiting/testing
      try {
        this.permissionService.testCamera();
        console.log('📱 Camera test: INITIATED');
      } catch (cameraError) {
        console.log('📱 Camera test: FAIL');
      }
      
      try {
        this.permissionService.testMicrophone();
        console.log('🎤 Microphone test: INITIATED');
      } catch (micError) {
        console.log('🎤 Microphone test: FAIL');
      }
    }
  }
}