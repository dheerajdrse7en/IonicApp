import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { ToastController, AlertController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class PermissionService {
  private permissionStatuses: {[key: string]: boolean} = {};

  constructor(
    private toastController: ToastController,
    private alertController: AlertController
  ) { }

  // Fixed method that returns Promise<boolean>
  async testCamera(): Promise<boolean> {
    try {
      console.log('🔧 Testing camera functionality...');
      return await this.testCameraHardware();
    } catch (error) {
      console.error('Camera test failed:', error);
      return false;
    }
  }

  // Fixed method that returns Promise<boolean>
  async testMicrophone(): Promise<boolean> {
    try {
      console.log('🔧 Testing microphone functionality...');
      return await this.testMicrophoneHardware();
    } catch (error) {
      console.error('Microphone test failed:', error);
      return false;
    }
  }

  // Fixed method that returns the permission statuses
  async getAllPermissionStatuses(): Promise<{[key: string]: boolean}> {
    try {
      // Return current permission statuses if available
      if (Object.keys(this.permissionStatuses).length > 0) {
        return this.permissionStatuses;
      }
      
      // Otherwise, check current permissions
      const webPermissions = await this.checkAllPermissions();
      const statuses: {[key: string]: boolean} = {};
      
      // Convert permission states to boolean
      for (const [key, value] of Object.entries(webPermissions)) {
        statuses[key] = value === 'granted';
      }
      
      return statuses;
    } catch (error) {
      console.error('Error getting permission statuses:', error);
      return {};
    }
  }

  async requestAllPermissions(): Promise<void> {
    if (Capacitor.getPlatform() === 'android') {
      try {
        console.log('🔐 Starting permission requests...');
        await this.showPermissionAlert();
        
        // Request web-based permissions with delay
        await this.requestWithDelay('Camera', () => this.requestCameraPermission());
        await this.requestWithDelay('Microphone', () => this.requestMicrophonePermission());
        await this.requestWithDelay('Location', () => this.requestLocationPermission());
        await this.requestWithDelay('Notifications', () => this.requestNotificationPermission());
        
        // Test hardware after permissions
        setTimeout(() => this.runHardwareTests(), 3000);
        
        console.log('✅ All permission requests completed');
        await this.showPermissionSummary();
      } catch (error) {
        console.error('❌ Error requesting permissions:', error);
        await this.showToast('Error requesting permissions', 'danger');
      }
    }
  }

  private async requestWithDelay(name: string, requestFn: () => Promise<boolean>): Promise<void> {
    try {
      console.log(`🔄 Requesting ${name} permission...`);
      const granted = await requestFn();
      this.permissionStatuses[name.toLowerCase()] = granted;
      
      const status = granted ? '✅ Granted' : '❌ Denied';
      console.log(`${status}: ${name} permission`);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error requesting ${name}:`, error);
      this.permissionStatuses[name.toLowerCase()] = false;
    }
  }

  async requestCameraPermission(): Promise<boolean> {
    try {
      // Request both front and back camera
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Test camera switching
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      console.log(`📱 Found ${videoDevices.length} camera(s)`);
      
      stream.getTracks().forEach(track => {
        console.log(`📹 Camera: ${track.label}`);
        track.stop();
      });
      
      return true;
    } catch (error) {
      console.error('Camera permission error:', error);
      return false;
    }
  }

  async requestMicrophonePermission(): Promise<boolean> {
    try {
      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
          channelCount: 1
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      stream.getTracks().forEach(track => {
        console.log(`🎤 Microphone: ${track.label}`);
        track.stop();
      });
      
      return true;
    } catch (error) {
      console.error('Microphone permission error:', error);
      return false;
    }
  }

  async requestLocationPermission(): Promise<boolean> {
    try {
      // Request high accuracy location
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
          }
        );
      });
      
      console.log(`📍 Location: ${position.coords.latitude}, ${position.coords.longitude}`);
      console.log(`🎯 Accuracy: ${position.coords.accuracy}m`);
      
      // Test location watching
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          console.log('📍 Location update:', pos.coords.latitude, pos.coords.longitude);
        },
        (error) => {
          console.error('Location watch error:', error);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 1000 }
      );
      
      // Stop watching after 2 seconds
      setTimeout(() => {
        navigator.geolocation.clearWatch(watchId);
        console.log('📍 Location watching stopped');
      }, 2000);
      
      return true;
    } catch (error) {
      console.error('Location permission error:', error);
      return false;
    }
  }

  async requestNotificationPermission(): Promise<boolean> {
    try {
      if ('Notification' in window) {
        let permission = Notification.permission;
        
        if (permission === 'default') {
          permission = await Notification.requestPermission();
        }
        
        if (permission === 'granted') {
          // Test notification
          const notification = new Notification('Permission Granted!', {
            body: 'All permissions have been successfully configured.',
            icon: '/assets/icon/favicon.png',
            badge: '/assets/icon/favicon.png',
            tag: 'permission-test'
          });
          
          setTimeout(() => notification.close(), 3000);
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Notification permission error:', error);
      return false;
    }
  }

  async runHardwareTests(): Promise<void> {
    console.log('🔧 Running hardware tests...');
    
    const tests = {
      camera: await this.testCameraHardware(),
      microphone: await this.testMicrophoneHardware(),
      sensors: await this.testSensors(),
      connectivity: await this.testConnectivity()
    };
    
    console.log('🔧 Hardware test results:', tests);
    await this.showHardwareTestResults(tests);
  }

  private async testCameraHardware(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      
      if (cameras.length === 0) return false;
      
      // Test each camera
      for (const camera of cameras) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: camera.deviceId }
          });
          stream.getTracks().forEach(track => track.stop());
          console.log(`✅ Camera test passed: ${camera.label}`);
        } catch (error) {
          console.log(`❌ Camera test failed: ${camera.label}`);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Camera hardware test failed:', error);
      return false;
    }
  }

  private async testMicrophoneHardware(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const microphones = devices.filter(device => device.kind === 'audioinput');
      
      if (microphones.length === 0) return false;
      
      // Test default microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      microphone.connect(analyser);
      analyser.fftSize = 256;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // Test for 1 second
      let hasAudio = false;
      const testDuration = 1000;
      const startTime = Date.now();
      
      const checkAudio = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        
        if (average > 0) hasAudio = true;
        
        if (Date.now() - startTime < testDuration) {
          requestAnimationFrame(checkAudio);
        } else {
          stream.getTracks().forEach(track => track.stop());
          audioContext.close();
          console.log(`🎤 Microphone test: ${hasAudio ? 'PASS' : 'FAIL'}`);
        }
      };
      
      checkAudio();
      return true;
    } catch (error) {
      console.error('Microphone hardware test failed:', error);
      return false;
    }
  }

  private async testSensors(): Promise<boolean> {
    try {
      let hasAccelerometer = false;
      let hasGyroscope = false;
      
      // Test accelerometer
      if ('DeviceMotionEvent' in window) {
        const handler = (event: DeviceMotionEvent) => {
          if (event.acceleration && (event.acceleration.x !== null || event.acceleration.y !== null || event.acceleration.z !== null)) {
            hasAccelerometer = true;
          }
          if (event.rotationRate && (event.rotationRate.alpha !== null || event.rotationRate.beta !== null || event.rotationRate.gamma !== null)) {
            hasGyroscope = true;
          }
        };
        
        window.addEventListener('devicemotion', handler);
        
        // Test for 2 seconds
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        window.removeEventListener('devicemotion', handler);
      }
      
      console.log(`📱 Accelerometer: ${hasAccelerometer ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
      console.log(`📱 Gyroscope: ${hasGyroscope ? 'AVAILABLE' : 'NOT AVAILABLE'}`);
      
      return hasAccelerometer || hasGyroscope;
    } catch (error) {
      console.error('Sensor test failed:', error);
      return false;
    }
  }

  private async testConnectivity(): Promise<boolean> {
    try {
      const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
      
      if (connection) {
        console.log(`📶 Connection type: ${connection.effectiveType}`);
        console.log(`📶 Downlink: ${connection.downlink} Mbps`);
        console.log(`📶 RTT: ${connection.rtt} ms`);
        return true;
      }
      
      return navigator.onLine;
    } catch (error) {
      console.error('Connectivity test failed:', error);
      return false;
    }
  }

  private async showPermissionAlert(): Promise<void> {
    const alert = await this.alertController.create({
      header: '🔐 Permissions Required',
      message: 'This app needs various permissions to function properly. Please allow all permissions when prompted.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
          handler: () => {
            console.log('Permission request cancelled');
          }
        },
        {
          text: 'Continue',
          handler: () => {
            console.log('Permission request accepted');
          }
        }
      ]
    });
    
    await alert.present();
    await alert.onDidDismiss();
  }

  private async showPermissionSummary(): Promise<void> {
    const granted = Object.values(this.permissionStatuses).filter(status => status).length;
    const total = Object.keys(this.permissionStatuses).length;
    
    await this.showToast(
      `Permissions: ${granted}/${total} granted`,
      granted === total ? 'success' : 'warning'
    );
  }

  private async showHardwareTestResults(results: any): Promise<void> {
    const passed = Object.values(results).filter(result => result).length;
    const total = Object.keys(results).length;
    
    await this.showToast(
      `Hardware Tests: ${passed}/${total} passed`,
      passed === total ? 'success' : 'warning'
    );
  }

  private async showToast(message: string, color: string = 'primary'): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      color,
      position: 'bottom',
      buttons: [
        {
          text: 'OK',
          role: 'cancel'
        }
      ]
    });
    
    await toast.present();
  }

  // Public methods for checking permissions
  async checkAllPermissions(): Promise<{[key: string]: string}> {
    const permissions = ['camera', 'microphone', 'geolocation', 'notifications'];
    const statuses: {[key: string]: string} = {};
    
    for (const permission of permissions) {
      try {
        if ('permissions' in navigator) {
          const result = await (navigator as any).permissions.query({ name: permission });
          statuses[permission] = result.state;
        } else {
          statuses[permission] = 'unknown';
        }
      } catch (error) {
        statuses[permission] = 'unknown';
      }
    }
    
    return statuses;
  }

  async getDeviceInfo(): Promise<any> {
    return {
      platform: Capacitor.getPlatform(),
      isNative: Capacitor.isNativePlatform(),
      userAgent: navigator.userAgent,
      language: navigator.language,
      languages: navigator.languages,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
      hardwareConcurrency: navigator.hardwareConcurrency,
      maxTouchPoints: navigator.maxTouchPoints,
      permissions: await this.checkAllPermissions()
    };
  }
}