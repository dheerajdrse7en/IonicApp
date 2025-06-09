import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { Platform, ToastController } from '@ionic/angular';
import { PermissionService } from './services/permissions.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
})
export class AppComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') canvas!: ElementRef<HTMLCanvasElement>;
  
  private currentStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private recordingInterval: any;
  
  isRecording = false;
  isCameraActive = false;
  currentCamera = 'user';
  recordingTime = 0;
  
  constructor(
    private platform: Platform,
    private permissionService: PermissionService,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    await this.platform.ready();
    await this.initializeApp();
  }

  ngOnDestroy() {
    this.stopCamera();
  }

  private async initializeApp() {
    try {
      console.log('🚀 Initializing app...');
      
      if (this.platform.is('android')) {
        await this.permissionService.requestAllPermissions();
        const statuses = await this.permissionService.getAllPermissionStatuses();
        console.log('📊 Permission statuses:', statuses);
      }
      
      console.log('✅ App initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing app:', error);
    }
  }

  async startCamera() {
    try {
      console.log('🎥 Starting camera...');
      
      if (this.currentStream) {
        this.stopCamera();
      }

      const constraints = {
        video: {
          facingMode: this.currentCamera,
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
          frameRate: { ideal: 30, min: 15 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      };

      this.currentStream = await navigator.mediaDevices.getUserMedia(constraints);

      if (this.videoElement?.nativeElement) {
        const video = this.videoElement.nativeElement;
        video.srcObject = this.currentStream;
        video.muted = true;
        video.playsInline = true;
        
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => {
            video.play();
            resolve();
          };
        });
        
        this.isCameraActive = true;
        
        const videoTrack = this.currentStream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        console.log('📹 Camera settings:', settings);
        
        await this.showToast('Camera started successfully', 'success');
      }
      
    } catch (error) {
      console.error('❌ Camera error:', error);
      await this.showToast(`Failed to start camera: error.message`, 'danger');
    }
  }

  stopCamera() {
    if (this.currentStream) {
      this.currentStream.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Stopped track:', track.kind);
      });
      this.currentStream = null;
    }
    
    if (this.videoElement?.nativeElement) {
      this.videoElement.nativeElement.srcObject = null;
    }
    
    this.isCameraActive = false;
    this.stopRecording();
  }

  async switchCamera() {
    if (!this.isCameraActive) return;
    
    this.currentCamera = this.currentCamera === 'user' ? 'environment' : 'user';
    await this.startCamera();
  }

  async startRecording() {
    if (!('MediaRecorder' in window)) {
      await this.showToast('MediaRecorder not supported on this browser.', 'danger');
      return;
    }

    if (!this.currentStream || this.isRecording) return;
    
    try {
      console.log('🔴 Starting recording...');
      
      const options = {
        mimeType: 'video/webm;codecs=vp9,opus',
        videoBitsPerSecond: 2500000,
        audioBitsPerSecond: 128000
      };
      
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options.mimeType = 'video/webm;codecs=vp8,opus';
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options.mimeType = 'video/webm';
        }
      }
      
      this.mediaRecorder = new MediaRecorder(this.currentStream, options);
      this.recordedChunks = [];
      
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = () => {
        this.saveRecording();
      };
      
      this.mediaRecorder.start(1000);
      this.isRecording = true;
      this.recordingTime = 0;
      
      this.recordingInterval = setInterval(() => {
        this.recordingTime++;
      }, 1000);
      
      await this.showToast('Recording started', 'success');
      
    } catch (error) {
      console.error('❌ Recording error:', error);
      await this.showToast(`Failed to start recording: error.message`, 'danger');
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      console.log('⏹️ Stopping recording...');
      this.mediaRecorder.stop();
      this.isRecording = false;
      
      if (this.recordingInterval) {
        clearInterval(this.recordingInterval);
        this.recordingInterval = null;
      }
    }
  }

  private saveRecording() {
    if (this.recordedChunks.length === 0) return;
    
    const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `recording_${new Date().toISOString()}.webm`;
    a.click();
    
    URL.revokeObjectURL(url);
    this.recordedChunks = [];
    this.recordingTime = 0;
    this.isRecording = false;

    
    console.log('💾 Recording saved');
    this.showToast('Recording saved successfully', 'success');
  }

  takePicture() {
    if (!this.videoElement?.nativeElement || !this.canvas?.nativeElement) return;
    
    const video = this.videoElement.nativeElement;
    const canvas = this.canvas.nativeElement;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `photo_${new Date().toISOString()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        
        this.showToast('Photo saved', 'success');
      }
    }, 'image/png');
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${this.pad(mins)}:${this.pad(secs)}`;
  }

  private pad(value: number): string {
    return value < 10 ? '0' + value : value.toString();
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}