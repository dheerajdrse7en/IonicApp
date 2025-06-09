import { Component, OnInit, ViewChild, ElementRef, OnDestroy } from '@angular/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Platform, AlertController, LoadingController, ToastController, IonicModule } from '@ionic/angular';
import { Share } from '@capacitor/share';
import { NgIf } from '@angular/common';
import { Camera } from '@capacitor/camera';

interface VideoFile {
  id: string;
  name: string;
  path: string;
  webPath?: string;
  size?: number;
  date: string;
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  // imports:[IonicModule,NgIf],
})
export class HomePage implements OnInit, OnDestroy {
  @ViewChild('cameraPreview', { static: false }) cameraPreview!: ElementRef<HTMLVideoElement>;
  @ViewChild('videoPlayer', { static: false }) videoPlayer!: ElementRef<HTMLVideoElement>;
  
  public videos: VideoFile[] = [];
  public currentVideo: VideoFile | null = null;
  public isRecording = false;
  public mediaRecorder: MediaRecorder | null = null;
  public recordedChunks: Blob[] = [];
  public stream: MediaStream | null = null;

  constructor(
    private platform: Platform,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    await this.loadVideos();
  }

  async captureVideo() {
    if (this.isRecording) {
      this.stopRecording();
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Starting camera...',
    });
    await loading.present();

    try {
      // Set recording state first to show the camera preview section
      this.isRecording = true;
      await this.startRecording();
    } catch (error) {
      console.error('Error capturing video:', error);
      this.isRecording = false;
      await this.showToast('Failed to access camera. Please check permissions.');
    } finally {
      await loading.dismiss();
    }
  }
  async requestPermissions(): Promise<boolean> {
    try {
      const cameraPerms = await Camera.requestPermissions();
      const filePerms = await Filesystem.requestPermissions();

      const cameraGranted = cameraPerms.camera === 'granted';
      const storageGranted = filePerms.publicStorage === 'granted';

      if (!cameraGranted || !storageGranted) {
        await this.showToast('Camera or Storage permission not granted.');
        return false;
      }

      return true;
    } catch (err) {
      console.error('Permission request error:', err);
      await this.showToast('Error requesting permissions.');
      return false;
    }
  }
  async startRecording() {
    try {
      // Request camera and microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user' // or 'environment' for back camera
        }, 
        audio: true 
      });  

      // Show camera preview - wait for the view to update first
      setTimeout(() => {
        if (this.cameraPreview?.nativeElement && this.stream) {
          this.cameraPreview.nativeElement.srcObject = this.stream;
          this.cameraPreview.nativeElement.play().catch(e => {
            console.log('Preview play failed:', e);
          });
        }
      }, 100);

      this.recordedChunks = [];
      
      // Check supported MIME types
      let mimeType = 'video/webm';
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9')) {
        mimeType = 'video/webm;codecs=vp9';
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8')) {
        mimeType = 'video/webm;codecs=vp8';
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      }

      this.mediaRecorder = new MediaRecorder(this.stream, {
        mimeType: mimeType
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.onstop = async () => {
        const blob = new Blob(this.recordedChunks, { 
          type: mimeType 
        });
        await this.saveRecordedVideo(blob, mimeType);
        this.cleanupCamera();
      };

      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        this.showToast('Recording error occurred');
      };

      this.mediaRecorder.start(1000); // Record in 1-second chunks
      // Don't set isRecording here since it's already set in captureVideo()
      await this.showToast('Recording started! Tap "Stop Recording" to finish.');

    } catch (error) {
      console.error('Error starting recording:', error);
      this.cleanupCamera();
      await this.showToast('Camera access denied or not available');
    }
  }

  stopRecording() {
    if (this.mediaRecorder && this.isRecording) {
      try {
        if (this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
        }
        this.isRecording = false;
        this.showToast('Recording stopped. Processing video...');
      } catch (error) {
        console.error('Error stopping recording:', error);
        this.isRecording = false;
        this.cleanupCamera();
      }
    }
  }

  cleanupCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
        console.log('Stopped track:', track.kind);
      });
      this.stream = null;
    }
    
    if (this.cameraPreview?.nativeElement) {
      this.cameraPreview.nativeElement.srcObject = null;
      this.cameraPreview.nativeElement.pause();
    }
    
    this.isRecording = false;
  }

  async saveRecordedVideo(blob: Blob, mimeType: string) {
    try {
      const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const fileName = `video_${Date.now()}.${extension}`;
      
      let savedPath = '';
      
      if (this.platform.is('hybrid')) {
        // Save to device filesystem on mobile
        const base64Data = await this.blobToBase64(blob);
        await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Data
        });
        savedPath = fileName;
      } else {
        // For web, we'll use the blob URL
        savedPath = fileName;
      }

      const videoFile: VideoFile = {
        id: Date.now().toString(),
        name: fileName,
        path: savedPath,
        webPath: URL.createObjectURL(blob),
        size: blob.size,
        date: new Date().toISOString()
      };

      this.videos.unshift(videoFile);
      await this.saveVideosToStorage();
      
      // Auto-play the newly recorded video
      this.currentVideo = videoFile;
      
      await this.showToast('Video recorded and saved successfully!');
    } catch (error) {
      console.error('Error saving video:', error);
      await this.showToast('Failed to save video');
    }
  }

  async playVideo(video: VideoFile) {
    try {
      this.currentVideo = video;
      
      if (!video.webPath && this.platform.is('hybrid')) {
        // For mobile, read the file and create object URL
        const file = await Filesystem.readFile({
          path: video.path,
          directory: Directory.Data
        });
        
        const mimeType = video.name.endsWith('.mp4') ? 'video/mp4' : 'video/webm';
        const blob = this.base64ToBlob(file.data as string, mimeType);
        video.webPath = URL.createObjectURL(blob);
      }

      // Wait for the view to update, then load the video
      setTimeout(() => {
        if (this.videoPlayer?.nativeElement) {
          this.videoPlayer.nativeElement.load();
        }
      }, 100);
      
    } catch (error) {
      console.error('Error reading video file:', error);
      await this.showToast('Failed to load video');
    }
  }

  async deleteVideo(video: VideoFile) {
    const alert = await this.alertController.create({
      header: 'Delete Video',
      message: 'Are you sure you want to delete this video?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Delete',
          handler: async () => {
            try {
              if (this.platform.is('hybrid')) {
                await Filesystem.deleteFile({
                  path: video.path,
                  directory: Directory.Data
                });
              }

              this.videos = this.videos.filter(v => v.id !== video.id);
              
              if (this.currentVideo?.id === video.id) {
                this.currentVideo = null;
              }

              // Clean up object URL
              if (video.webPath && video.webPath.startsWith('blob:')) {
                URL.revokeObjectURL(video.webPath);
              }

              await this.saveVideosToStorage();
              await this.showToast('Video deleted successfully');
            } catch (error) {
              console.error('Error deleting video:', error);
              await this.showToast('Failed to delete video');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  async shareVideo(video: VideoFile) {
    try {
      if (this.platform.is('hybrid')) {
        // For mobile platforms
        const file = await Filesystem.readFile({
          path: video.path,
          directory: Directory.Data
        });
        
        // Create a temporary file for sharing
        const tempFileName = `temp_${video.name}`;
        await Filesystem.writeFile({
          path: tempFileName,
          data: file.data,
          directory: Directory.Cache
        });

        await Share.share({
          title: 'Share Video',
          text: 'Check out this video!',
          url: tempFileName,
        });
      } else {
        // For web
        if (navigator.share && video.webPath) {
          const response = await fetch(video.webPath);
          const blob = await response.blob();
          const videoFile = new File([blob], video.name, { 
            type: video.name.endsWith('.mp4') ? 'video/mp4' : 'video/webm' 
          });
          
          await navigator.share({
            title: 'Share Video',
            text: 'Check out this video!',
            files: [videoFile]
          });
        } else {
          await this.showToast('Sharing not supported on this platform');
        }
      }
    } catch (error) {
      console.error('Error sharing video:', error);
      await this.showToast('Failed to share video');
    }
  }

  private async loadVideos() {
    try {
      const { value } = await Preferences.get({ key: 'videos' });
      if (value) {
        this.videos = JSON.parse(value);
      }
    } catch (error) {
      console.error('Error loading videos:', error);
    }
  }

  private async saveVideosToStorage() {
    try {
      // Remove webPath before saving (it's temporary)
      const videosToSave = this.videos.map(video => ({
        ...video,
        webPath: undefined
      }));
      
      await Preferences.set({
        key: 'videos',
        value: JSON.stringify(videosToSave)
      });
    } catch (error) {
      console.error('Error saving videos to storage:', error);
    }
  }

  private async showToast(message: string) {
    const toast = await this.toastController.create({
      message,
      duration: 3000,
      position: 'bottom'
    });
    await toast.present();
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result as string;
        resolve(base64data.split(',')[1]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  private base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  }

  formatFileSize(bytes?: number): string {
    if (!bytes) return 'Unknown size';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  trackByVideoId(index: number, video: VideoFile): string {
    return video.id;
  }

  ngOnDestroy() {
    // Clean up when component is destroyed
    this.cleanupCamera();
    
    // Clean up object URLs
    this.videos.forEach(video => {
      if (video.webPath && video.webPath.startsWith('blob:')) {
        URL.revokeObjectURL(video.webPath);
      }
    });
  }
}