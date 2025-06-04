// ui/videoOverlay.js
/**
 * Video overlay system for playing milestone videos over the minimap
 * Provides synchronized audio-visual feedback for game achievements
 */
export class VideoOverlay {
  constructor() {
    this.isPlaying = false
    this.currentVideo = null
    this.currentAudio = null
    this.overlayElement = null
    this.videoQueue = []
    this.createOverlayElement()
  }

  /**
   * Create the video overlay DOM element
   */
  createOverlayElement() {
    this.overlayElement = document.createElement('div')
    this.overlayElement.id = 'video-overlay'
    this.overlayElement.className = 'video-overlay hidden'
    
    this.overlayElement.innerHTML = `
      <div class="video-container">
        <video class="milestone-video" muted playsinline>
          Your browser does not support the video tag.
        </video>
        <div class="video-controls">
          <div class="milestone-info">
            <h3 class="milestone-title"></h3>
            <p class="milestone-description"></p>
          </div>
          <button class="skip-video-btn">Skip</button>
        </div>
        <div class="video-progress">
          <div class="progress-bar"></div>
        </div>
      </div>
    `

    // Add CSS styles
    this.addStyles()
    
    // Append to body
    document.body.appendChild(this.overlayElement)

    // Set up event listeners
    this.setupEventListeners()
  }

  /**
   * Add CSS styles for the video overlay
   */
  addStyles() {
    const style = document.createElement('style')
    style.textContent = `
      .video-overlay {
        position: fixed;
        top: 50px;
        right: 20px;
        width: 300px;
        height: 200px;
        z-index: 1000;
        background: rgba(0, 0, 0, 0.9);
        border: 2px solid #00ff00;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 255, 0, 0.3);
        transition: all 0.3s ease;
        overflow: hidden;
      }

      .video-overlay.hidden {
        opacity: 0;
        transform: translateX(100%);
        pointer-events: none;
      }

      .video-overlay.show {
        opacity: 1;
        transform: translateX(0);
        pointer-events: all;
      }

      .video-container {
        width: 100%;
        height: 100%;
        position: relative;
        display: flex;
        flex-direction: column;
      }

      .milestone-video {
        width: 100%;
        height: 140px;
        object-fit: cover;
        background: #000;
      }

      .video-controls {
        padding: 8px;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-grow: 1;
      }

      .milestone-info {
        flex-grow: 1;
        margin-right: 10px;
      }

      .milestone-title {
        color: #00ff00;
        font-size: 12px;
        margin: 0 0 4px 0;
        font-weight: bold;
        text-shadow: 0 0 4px rgba(0, 255, 0, 0.5);
      }

      .milestone-description {
        color: #ffffff;
        font-size: 10px;
        margin: 0;
        opacity: 0.8;
        line-height: 1.2;
      }

      .skip-video-btn {
        background: rgba(255, 0, 0, 0.8);
        color: white;
        border: 1px solid #ff0000;
        padding: 4px 8px;
        font-size: 10px;
        cursor: pointer;
        border-radius: 3px;
        transition: background 0.2s;
      }

      .skip-video-btn:hover {
        background: rgba(255, 0, 0, 1);
      }

      .video-progress {
        height: 3px;
        background: rgba(255, 255, 255, 0.2);
        position: relative;
      }

      .progress-bar {
        height: 100%;
        background: #00ff00;
        width: 0%;
        transition: width 0.1s linear;
        box-shadow: 0 0 4px rgba(0, 255, 0, 0.5);
      }

      .video-overlay.priority-high {
        border-color: #ff6600;
        box-shadow: 0 4px 20px rgba(255, 102, 0, 0.5);
      }

      .video-overlay.priority-high .milestone-title {
        color: #ff6600;
        text-shadow: 0 0 4px rgba(255, 102, 0, 0.5);
      }

      .video-overlay.priority-medium {
        border-color: #ffff00;
        box-shadow: 0 4px 20px rgba(255, 255, 0, 0.3);
      }

      .video-overlay.priority-medium .milestone-title {
        color: #ffff00;
        text-shadow: 0 0 4px rgba(255, 255, 0, 0.5);
      }
    `
    document.head.appendChild(style)
  }

  /**
   * Set up event listeners for video controls
   */
  setupEventListeners() {
    const skipBtn = this.overlayElement.querySelector('.skip-video-btn')
    const video = this.overlayElement.querySelector('.milestone-video')
    const progressBar = this.overlayElement.querySelector('.progress-bar')

    skipBtn.addEventListener('click', () => {
      this.stopCurrentVideo()
    })

    // Update progress bar during video playback
    video.addEventListener('timeupdate', () => {
      if (video.duration) {
        const progress = (video.currentTime / video.duration) * 100
        progressBar.style.width = `${progress}%`
      }
    })

    // Handle video end
    video.addEventListener('ended', () => {
      this.stopCurrentVideo()
    })

    // Handle video errors
    video.addEventListener('error', (e) => {
      console.error('Video playback error:', e)
      this.stopCurrentVideo()
    })
  }

  /**
   * Play a milestone video with synchronized audio
   */
  async playMilestoneVideo(videoFile, audioFile, milestoneInfo = {}) {
    // If already playing, queue the video
    if (this.isPlaying) {
      this.videoQueue.push({ videoFile, audioFile, milestoneInfo })
      return
    }

    try {
      const video = this.overlayElement.querySelector('.milestone-video')
      const titleElement = this.overlayElement.querySelector('.milestone-title')
      const descriptionElement = this.overlayElement.querySelector('.milestone-description')
      const progressBar = this.overlayElement.querySelector('.progress-bar')

      // Set milestone info
      titleElement.textContent = milestoneInfo.title || 'Milestone Achieved'
      descriptionElement.textContent = milestoneInfo.description || ''

      // Set priority styling
      this.overlayElement.className = `video-overlay priority-${milestoneInfo.priority || 'low'}`

      // Load video
      video.src = `/video/${videoFile}`
      
      // Load and play audio
      if (audioFile) {
        this.currentAudio = new Audio(`/video/${audioFile}`)
        this.currentAudio.volume = 0.7 // Slightly lower volume than game sounds
      }

      // Show overlay (but make it invisible since we'll render on minimap)
      this.overlayElement.classList.add('show')
      this.overlayElement.style.opacity = '0' // Hide DOM overlay, use minimap rendering
      this.isPlaying = true
      this.currentVideo = video

      // Reset progress
      progressBar.style.width = '0%'

      // Start video playback
      await video.play()

      // Synchronize audio
      if (this.currentAudio) {
        // Small delay to account for video start time
        setTimeout(() => {
          if (this.isPlaying && this.currentAudio) {
            this.currentAudio.play().catch(e => {
              console.warn('Audio playback failed:', e)
            })
          }
        }, 50)
      }

    } catch (error) {
      console.error('Failed to play milestone video:', error)
      this.stopCurrentVideo()
    }
  }

  /**
   * Stop current video and play next in queue
   */
  stopCurrentVideo() {
    this.isPlaying = false

    // Hide overlay
    this.overlayElement.classList.remove('show')

    // Stop and clean up video
    if (this.currentVideo) {
      this.currentVideo.pause()
      this.currentVideo.currentTime = 0
      this.currentVideo.src = ''
      this.currentVideo = null
    }

    // Stop and clean up audio
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.currentTime = 0
      this.currentAudio = null
    }

    // Reset progress bar
    const progressBar = this.overlayElement.querySelector('.progress-bar')
    progressBar.style.width = '0%'

    // Play next video in queue
    if (this.videoQueue.length > 0) {
      const nextVideo = this.videoQueue.shift()
      setTimeout(() => {
        this.playMilestoneVideo(nextVideo.videoFile, nextVideo.audioFile, nextVideo.milestoneInfo)
      }, 500) // Small delay between videos
    }
  }

  /**
   * Check if video is currently playing
   */
  isVideoPlaying() {
    return this.isPlaying
  }

  /**
   * Get current video element for canvas rendering
   */
  getCurrentVideo() {
    return this.currentVideo
  }

  /**
   * Get video progress (0-1)
   */
  getVideoProgress() {
    if (!this.currentVideo || !this.currentVideo.duration) {
      return 0
    }
    return this.currentVideo.currentTime / this.currentVideo.duration
  }

  /**
   * Clear video queue
   */
  clearQueue() {
    this.videoQueue = []
  }

  /**
   * Destroy the overlay
   */
  destroy() {
    this.stopCurrentVideo()
    this.clearQueue()
    if (this.overlayElement && this.overlayElement.parentNode) {
      this.overlayElement.parentNode.removeChild(this.overlayElement)
    }
  }
}

// Create global instance
export const videoOverlay = new VideoOverlay()

/**
 * Convenience function for playing milestone videos by base filename
 */
export function playMilestoneVideo(videoFile, audioFile, milestoneInfo) {
  return videoOverlay.playMilestoneVideo(videoFile, audioFile, milestoneInfo)
}

/**
 * Convenience function for playing video and audio in sync by base filename
 * @param {string} baseFilename - The base filename without extension (e.g., 'tank_over_crystals')
 * @param {object} options - Optional settings for the video playback
 */
export function playSyncedVideoAudio(baseFilename, options = {}) {
  console.log('playSyncedVideoAudio called with:', baseFilename, options)
  const videoFile = `${baseFilename}.mp4`
  const audioFile = `${baseFilename}.mp3`
  
  const milestoneInfo = {
    title: options.title || 'Video Playback',
    description: options.description || '',
    priority: options.priority || 'medium'
  }
  
  return videoOverlay.playMilestoneVideo(videoFile, audioFile, milestoneInfo)
}