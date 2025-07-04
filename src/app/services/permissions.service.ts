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

  async testCamera(): Promise<boolean> {
    try {
      console.log('🔧 Testing camera functionality...');
      return await this.testCameraHardware();
    } catch (error) {
      console.error('Camera test failed:', error);
      return false;
    }
  }

  async testMicrophone(): Promise<boolean> {
    try {
      console.log('🔧 Testing microphone functionality...');
      return await this.testMicrophoneHardware();
    } catch (error) {
      console.error('Microphone test failed:', error);
      return false;
    }
  }

  async getAllPermissionStatuses(): Promise<{[key: string]: boolean}> {
    try {
      if (Object.keys(this.permissionStatuses).length > 0) {
        return this.permissionStatuses;
      }
      
      const webPermissions = await this.checkAllPermissions();
      const statuses: {[key: string]: boolean} = {};
      
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
        
        await this.requestWithDelay('Camera', () => this.requestCameraPermission());
        await this.requestWithDelay('Microphone', () => this.requestMicrophonePermission());
        await this.requestWithDelay('Location', () => this.requestLocationPermission());
        await this.requestWithDelay('Notifications', () => this.requestNotificationPermission());
        
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
      
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Error requesting ${name}:`, error);
      this.permissionStatuses[name.toLowerCase()] = false;
    }
  }

  async requestCameraPermission(): Promise<boolean> {
    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 }
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
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

  private async testCameraHardware(): Promise<boolean> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(device => device.kind === 'videoinput');
      
      if (cameras.length === 0) return false;
      
      for (const camera of cameras) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { 
              deviceId: camera.deviceId,
              width: { ideal: 1920 },
              height: { ideal: 1080 }
            }
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
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      microphone.connect(analyser);
      analyser.fftSize = 256;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
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