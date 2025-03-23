/**
 * Horse Class
 * Manages individual horses in the race
 */
class Horse {
    constructor(scene, lane, name, color) {
        this.scene = scene;
        this.lane = lane;
        this.name = name || nameGenerator.generateName();
        this.color = color || this.getRandomColor();
        
        // Total equality approach - all horses have similar base stats
        // Small differences create tight pack racing
        const baseSpeedValue = 1.9; 
        const baseStaminaValue = 0.85;
        const baseAccelerationValue = 0.3; 
        
        // Very small random variation to create slight differences
        this.baseSpeed = baseSpeedValue + (Math.random() * 0.06) - 0.03; // 1.37 to 1.43 (tighter range)
        this.stamina = baseStaminaValue + (Math.random() * 0.06) - 0.03; // 0.82 to 0.88 (tighter range)
        this.acceleration = baseAccelerationValue + (Math.random() * 0.06) - 0.03; // 0.27 to 0.33 (tighter range)
        
        // Moderate luck factor - still allows for some randomness
        this.luckFactor = Math.random() * 0.2 + 0.05; // Between 0.05 and 0.25 (reduced)
        
        // Current state
        this.currentSpeed = 0;
        this.distance = 0;
        this.currentLap = 1;
        this.finished = false;
        this.finishTime = null;
        this.position = null;
        
        // Enhanced catch-up mechanics
        this.catchUpFactor = 0;
        this.leadHandicap = 0;
        
        // Racing event timers - less frequent events
        this.nextEventTime = 3000 + Math.random() * 4000; // First event occurs 3-7 seconds into race
        this.eventDuration = 0;
        this.currentEvent = null;
        this.eventMultiplier = 1.0;
        
        // More subtle momentum system
        this.momentum = 0; // Ranges from -0.2 to +0.2, affects speed
        
        // Less dramatic lap-specific factors with narrower range for tighter pack
        this.lapFactors = [];
        for (let i = 0; i < this.scene.totalLaps; i++) {
            this.lapFactors.push({
                speedBoost: (Math.random() * 0.2) - 0.1, // Between -0.1 and +0.1 (narrower range)
                staminaBoost: (Math.random() * 0.16) - 0.08 // Between -0.08 and +0.08 (narrower range)
            });
        }
        
        // Sprite configuration
        this.sprite = null;
        this.nameText = null;
        this.connectingLine = null;
        
        // Use a middle lane as the reference path for all horses
        const referenceIndex = Math.floor(this.scene.numHorses / 2) - 1; 
        const laneWidth = Math.min(this.scene.trackWidth, this.scene.trackHeight) / 300; 
        // Set all horses to follow the middle lane's path with minimal variation
        this.laneOffset = (this.scene.numHorses - 1 - referenceIndex) * laneWidth;
        // Add a tiny offset for visual separation (1/10th of the already small lane width)
        this.laneOffset += (this.lane - referenceIndex) * (laneWidth * 0.1);
        
        // Initialize sprite
        this.createSprite();
    }
    
    getRandomColor() {
        const colors = [
            0xff0000, 
            0x00ff00, 
            0x0000ff, 
            0xffff00, 
            0xff00ff, 
            0x00ffff, 
            0xffa500, 
            0x800080, 
            0x008000, 
            0x800000, 
            0x808000, 
            0x008080, 
        ];
        
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    createSprite() {
        // Calculate a small horizontal offset based on lane number to fan out horses at the start
        // This will position them slightly to the right
        const horizontalOffset = this.lane * 20; // Adjust this value to control the spread
        
        // Get starting position
        const startPosition = this.scene.getPositionOnTrack(0, this.laneOffset);
        
        // Apply the horizontal offset to fan out horses to the right
        const offsetX = startPosition.x + horizontalOffset;
        
        // Create horse sprite using the silhouette image
        this.sprite = this.scene.add.image(offsetX, startPosition.y, 'horse');
        
        // Scale the sprite to an even smaller size
        const scaleBase = Math.min(this.scene.trackWidth, this.scene.trackHeight) / 8000;
        this.sprite.setScale(Math.max(0.015, scaleBase));
        
        // Flip the sprite horizontally so horses face left at the start of the race
        this.sprite.scaleX = -this.sprite.scaleX;
        
        // Apply color tint to the horse silhouette
        this.sprite.setTint(this.color);
        
        // Set initial rotation to match the track
        this.sprite.rotation = startPosition.rotation + Math.PI/2; 
        
        // Add running animation
        this.legMovement = 0;
        
        // Lane number - position relative to track dimensions
        const laneTextY = this.scene.trackCenterY - (this.scene.trackHeight * 0.4) + (this.lane * (this.scene.trackHeight * 0.06));
        this.laneText = this.scene.add.text(20, laneTextY, `#${this.lane + 1}: ${this.name}`, { 
            fontSize: '16px', 
            fontFamily: 'Arial',
            color: '#000'
        });
        
        // Add varying offsets based on lane number to prevent stacking
        // Position labels further away from horses to make room for connecting lines
        const horizontalVariation = (this.lane % 2 === 0) ? -40 - (this.lane * 3) : 40 + (this.lane * 3);
        // Increase vertical offset to hover labels higher above horses
        const verticalVariation = -40 - (this.lane * 5); // Negative values move upward
        
        // Horse name follows the horse - adjust text position based on horse size
        const nameOffsetX = this.sprite.width * this.sprite.scale * 0.5;
        const nameOffsetY = this.sprite.height * this.sprite.scale * 0.5;
        this.nameText = this.scene.add.text(offsetX - nameOffsetX + horizontalVariation, startPosition.y - nameOffsetY + verticalVariation, this.name, { 
            fontSize: '14px', 
            fontFamily: 'Arial',
            color: '#000',
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            padding: { x: 2, y: 1 }
        });
        
        // Create connecting line
        this.connectingLine = this.scene.add.graphics();
        
        // Group all elements
        this.group = this.scene.add.group([this.sprite, this.laneText, this.nameText, this.connectingLine]);
    }
    
    update(time, delta) {
        if (this.finished) return;
        
        // Debug log on first few updates for first horse only
        if (this.lane === 0 && this.distance < 100) {
            console.log(`Horse ${this.name} update: speed=${this.currentSpeed.toFixed(2)}, distance=${this.distance.toFixed(2)}`);
        }
        
        // Calculate which lap we're on - this is critical for the 4-lap race
        const previousLap = this.currentLap;
        this.currentLap = Math.min(this.scene.totalLaps, Math.floor(this.distance / this.scene.trackLength) + 1);
        
        // Detect lap change and log it
        if (this.currentLap > previousLap) {
            console.log(`${this.name} starting lap ${this.currentLap} of ${this.scene.totalLaps}`);
            // Add excitement - sometimes horses get a surge when starting a new lap
            if (Math.random() < 0.3) {
                this.momentum += Math.random() * 0.15;
                console.log(`${this.name} gets a surge of energy at the start of lap ${this.currentLap}!`);
            }
            
            // Special final lap balancing
            if (this.currentLap === this.scene.totalLaps) {
                this.applyFinalLapBalancing();
            }
        }
        
        // Handle random race events
        this.handleRaceEvents(time, delta);
        
        // Calculate catch-up factor based on position in the race
        this.updateRacePositioningFactors();
        
        // Get lap-specific performance factors
        const lapIndex = this.currentLap - 1;
        const lapFactor = this.lapFactors[lapIndex] || { speedBoost: 0, staminaBoost: 0 };
        
        // Apply momentum (gradually decays)
        if (Math.abs(this.momentum) > 0.01) {
            this.momentum *= 0.995; 
        } else {
            this.momentum = 0;
        }
        
        // Calculate speed based on time and current lap factor
        const raceProgress = this.distance / this.scene.totalRaceDistance;
        const staminaFactor = Math.max(0.7, 1 - raceProgress / (this.stamina + lapFactor.staminaBoost));
        
        // More variable random factor that changes each update
        const instantRandomFactor = 1 + (Math.random() - 0.5) * (this.luckFactor + 0.15);
        const raceEventFactor = this.eventMultiplier; 
        
        // Accelerate up to base speed, applying all factors
        const targetSpeed = this.baseSpeed * (1 + lapFactor.speedBoost + this.catchUpFactor - this.leadHandicap + this.momentum);
        
        if (this.currentSpeed < targetSpeed) {
            // Faster acceleration for trailing horses
            const accelerationBoost = 1 + this.catchUpFactor;
            this.currentSpeed += this.acceleration * accelerationBoost * (delta / 1000);
        } else if (this.currentSpeed > targetSpeed * 1.1) {
            // Decelerate if going too fast (momentum or events pushed speed too high)
            this.currentSpeed -= this.acceleration * 0.5 * (delta / 1000);
        }
        
        // Ensure minimum speed for all horses (creates a more consistent and exciting race)
        const minRaceSpeed = 0.7 + (this.catchUpFactor * 1.5); 
        this.currentSpeed = Math.max(minRaceSpeed, this.currentSpeed);
        
        // Apply all speed factors
        const actualSpeed = this.currentSpeed * staminaFactor * instantRandomFactor * raceEventFactor;
        
        // Move horse forward - scale speed based on track size, but slower overall
        const speedScale = Math.max(0.7, Math.min(this.scene.trackWidth, this.scene.trackHeight) / 400); 
        this.distance += actualSpeed * (delta / 1000) * 80 * speedScale; 
        
        // Get position on the oval track - this function handles the looping
        const lapDistance = this.distance % this.scene.trackLength;
        const trackPos = this.scene.getPositionOnTrack(lapDistance, this.laneOffset);
        
        // Update sprite positions
        this.sprite.x = trackPos.x;
        this.sprite.y = trackPos.y;
        
        // Determine if the horse is moving left or right based on rotation
        // When moving left (rotation between PI/2 and 3*PI/2), flip the sprite
        const isMovingLeft = trackPos.rotation > Math.PI/2 && trackPos.rotation < 3*Math.PI/2;
        
        // Set scale to flip horizontally when moving left
        const currentScale = Math.abs(this.sprite.scaleX);
        this.sprite.scaleX = -currentScale;
        
        // Set rotation based on track position
        this.sprite.rotation = trackPos.rotation + Math.PI/2;
        
        // Update name text position
        if (this.nameText) {
            const nameOffsetX = this.sprite.width * this.sprite.scale * 0.5;
            const nameOffsetY = this.sprite.height * this.sprite.scale * 0.5;
            const horizontalVariation = (this.lane % 2 === 0) ? -40 - (this.lane * 3) : 40 + (this.lane * 3);
            const verticalVariation = -40 - (this.lane * 5); 
            this.nameText.x = this.sprite.x - nameOffsetX + horizontalVariation;
            this.nameText.y = this.sprite.y - nameOffsetY + verticalVariation;
        }
        
        // Update connecting line
        this.updateConnectingLine();
        
        // Add a slight bobbing motion for running effect
        this.legMovement = (this.legMovement || 0) + delta * 0.01;
        const bobHeight = Math.sin(this.legMovement) * 1; 
        this.sprite.y += bobHeight;
        
        // Check if horse has finished race
        const totalDistance = this.scene.totalLaps * this.scene.trackLength;
        if (!this.finished && this.distance >= totalDistance && lapDistance >= 0 && lapDistance <= 50) {
            this.finishRace(time);
        }
    }
    
    updateConnectingLine() {
        if (!this.connectingLine || !this.sprite || !this.nameText) return;
        
        // Clear previous line
        this.connectingLine.clear();
        
        // Set line style - make it thinner and more transparent for better visibility
        this.connectingLine.lineStyle(0.8, this.color, 0.6);
        
        // Calculate start point (bottom center of name text)
        const startX = this.nameText.x + this.nameText.width / 2;
        const startY = this.nameText.y + this.nameText.height;
        
        // Calculate end point (top center of horse sprite)
        const endX = this.sprite.x;
        const endY = this.sprite.y - (this.sprite.height * this.sprite.scale * 0.3);
        
        // Draw the line
        this.connectingLine.beginPath();
        this.connectingLine.moveTo(startX, startY);
        this.connectingLine.lineTo(endX, endY);
        this.connectingLine.closePath();
        this.connectingLine.strokePath();
    }
    
    handleRaceEvents(time, delta) {
        // Random events that can happen during the race - reduced frequency and impact
        if (this.scene.raceStartTime && time > this.scene.raceStartTime + this.nextEventTime) {
            // If an event is already happening, process it
            if (this.currentEvent) {
                this.eventDuration -= delta;
                
                if (this.eventDuration <= 0) {
                    // End the current event
                    console.log(`${this.name}'s ${this.currentEvent} has ended`);
                    this.currentEvent = null;
                    this.eventMultiplier = 1.0;
                    
                    // Schedule next event - less frequent events
                    this.nextEventTime = time - this.scene.raceStartTime + 5000 + Math.random() * 7000;
                }
            } else {
                // Start a new random event with reduced chances and less dramatic effects
                const eventChance = Math.random();
                
                if (eventChance < 0.12) {
                    // Burst of speed (12% chance, down from 20%)
                    this.currentEvent = "burst of speed";
                    this.eventMultiplier = 1.25; // Reduced from 1.5
                    this.eventDuration = 800 + Math.random() * 1200;
                    console.log(`${this.name} finds a burst of speed!`);
                } else if (eventChance < 0.24) {
                    // Slow down (12% chance, down from 20%)
                    this.currentEvent = "slight slowdown";
                    this.eventMultiplier = 0.85; // Less significant slowdown (up from 0.7)
                    this.eventDuration = 800 + Math.random() * 1200;
                    console.log(`${this.name} slows slightly`);
                } else if (eventChance < 0.36) {
                    // Subtle momentum shift (12% chance, down from 20%)
                    if (Math.random() < 0.5) {
                        this.momentum += 0.15 + Math.random() * 0.1; // Reduced momentum shift
                        console.log(`${this.name} makes a move!`);
                    } else {
                        this.momentum -= 0.1 + Math.random() * 0.15; // Reduced negative momentum
                        console.log(`${this.name} loses a bit of momentum`);
                    }
                    // No event duration, just a momentum change
                    this.nextEventTime = time - this.scene.raceStartTime + 5000 + Math.random() * 7000;
                } else if (eventChance < 0.42) {
                    // Comeback effort (6% chance, down from 10%)
                    if (this.catchUpFactor > 0.2) { // Only if already behind
                        this.currentEvent = "comeback effort";
                        this.eventMultiplier = 1.35; // Reduced from 1.7
                        this.eventDuration = 1000 + Math.random() * 1000;
                        console.log(`${this.name} is making a comeback effort!`);
                    } else {
                        // Fallback to standard event
                        this.nextEventTime = time - this.scene.raceStartTime + 4000 + Math.random() * 6000;
                    }
                } else if (eventChance < 0.48) {
                    // Brief fatigue (6% chance, down from 10%)
                    this.currentEvent = "brief fatigue";
                    this.eventMultiplier = 0.8; // Less significant slowdown (up from 0.6)
                    this.eventDuration = 1000 + Math.random() * 1000;
                    console.log(`${this.name} shows signs of fatigue`);
                } else {
                    // No event (52% chance, up from 20%)
                    this.nextEventTime = time - this.scene.raceStartTime + 4000 + Math.random() * 6000;
                }
            }
        }
    }
    
    updateRacePositioningFactors() {
        if (!this.scene.raceInProgress || this.finished) return;
        
        // Get all active horses
        const activeHorses = this.scene.horses.filter(h => !h.finished);
        if (activeHorses.length <= 1) return;
        
        // Sort horses by distance
        const sortedHorses = [...activeHorses].sort((a, b) => b.distance - a.distance);
        
        // Find horse position
        const position = sortedHorses.findIndex(h => h === this);
        
        // More moderate catch-up mechanics for trailing horses - keep the pack together
        if (position > 0) {
            // Calculate how far behind this horse is (as a percentage of track length)
            const leader = sortedHorses[0];
            const distanceBehind = leader.distance - this.distance;
            const percentBehind = distanceBehind / this.scene.trackLength;
            
            // More moderate position-based component (0.03 to 0.25 based on position)
            const positionFactor = Math.min(0.25, 0.03 * position);
            
            // More moderate distance-based component (up to 0.25 more for being far behind)
            const distanceFactor = Math.min(0.25, percentBehind * 1.5);
            
            // Combined catch-up factor with smaller random variation
            const randomBoost = Math.random() * 0.1; 
            this.catchUpFactor = positionFactor + distanceFactor + randomBoost;
            
            // Add smaller boost for last place horse
            if (position === sortedHorses.length - 1) {
                this.catchUpFactor += 0.15; 
            }
            
            // Less frequent random chance for recovery
            if (Math.random() < 0.02 && position > sortedHorses.length / 2) {
                this.momentum += 0.2; 
                console.log(`${this.name} makes a move to catch up!`);
            }
        } else {
            // Leader gets a smaller handicap to keep pack closer
            const secondPlace = sortedHorses[1];
            const leadDistance = this.distance - secondPlace.distance;
            const percentAhead = leadDistance / this.scene.trackLength;
            
            // Leader handicap increases with lead percentage (reduced to max 0.3 from 0.6)
            this.leadHandicap = Math.min(0.3, percentAhead * 2.0);
            
            // Less frequent random chance for leader to slow slightly
            if (Math.random() < 0.05 && percentAhead > 0.03) {
                this.momentum -= 0.1; 
                console.log(`${this.name} eases the pace slightly!`);
            }
            
            this.catchUpFactor = 0;
        }
    }
    
    applyFinalLapBalancing() {
        // Final lap balancing - much more moderate to keep pack together
        console.log(`${this.name} entering final lap balancing`);
        
        // Get all active horses
        const activeHorses = this.scene.horses.filter(h => !h.finished);
        if (activeHorses.length <= 1) return;
        
        // Sort horses by distance
        const sortedHorses = [...activeHorses].sort((a, b) => b.distance - a.distance);
        
        // Find horse position
        const position = sortedHorses.findIndex(h => h === this);
        const totalHorses = sortedHorses.length;
        
        if (position === 0) {
            // Leader gets a smaller handicap on final lap to keep pack together
            // but not so dramatic that they lose completely
            const secondPlace = sortedHorses[1];
            const leadDistance = this.distance - secondPlace.distance;
            
            // More moderate handicap for leader
            if (leadDistance > this.scene.trackLength * 0.05) {
                // If lead is significant, apply gentle handicap
                this.momentum -= 0.1;
                console.log(`${this.name} feels the pressure of the final lap`);
            }
        } else {
            // Trailing horses get modest boost based on position
            // The further back, the more boost, but still moderate
            const boostFactor = Math.min(0.1 + (position / totalHorses) * 0.15, 0.25);
            this.momentum += boostFactor;
            
            // Last place gets slightly more help but not dramatic
            if (position === totalHorses - 1) {
                this.momentum += 0.1;
            }
            
            console.log(`${this.name} gets motivated for the final lap (boost: ${boostFactor.toFixed(2)})`);
        }
    }
    
    reset() {
        this.currentSpeed = 0;
        this.distance = 0;
        this.currentLap = 1;
        this.finished = false;
        this.finishTime = null;
        this.position = null;
        this.catchUpFactor = 0;
        this.leadHandicap = 0; 
        
        // Use a middle lane as the reference path for all horses
        const referenceIndex = Math.floor(this.scene.numHorses / 2) - 1; 
        const laneWidth = Math.min(this.scene.trackWidth, this.scene.trackHeight) / 300; 
        // Set all horses to follow the middle lane's path with minimal variation
        this.laneOffset = (this.scene.numHorses - 1 - referenceIndex) * laneWidth;
        // Add a tiny offset for visual separation (1/10th of the already small lane width)
        this.laneOffset += (this.lane - referenceIndex) * (laneWidth * 0.1);
        
        // Reset position back to starting position
        const startPosition = this.scene.getPositionOnTrack(0, this.laneOffset);
        
        // Apply the same horizontal offset as in createSprite to maintain fan-out effect
        const horizontalOffset = this.lane * 20; // Keep this value consistent with createSprite
        const offsetX = startPosition.x + horizontalOffset;
        
        this.sprite.x = offsetX;
        this.sprite.y = startPosition.y;
        this.sprite.rotation = startPosition.rotation + Math.PI/2;
        
        // Update name text position
        const nameOffsetX = this.sprite.width * this.sprite.scale * 0.5;
        const nameOffsetY = this.sprite.height * this.sprite.scale * 0.5;
        if (this.nameText) {
            const horizontalVariation = (this.lane % 2 === 0) ? -40 - (this.lane * 3) : 40 + (this.lane * 3);
            const verticalVariation = -40 - (this.lane * 5); 
            this.nameText.x = offsetX - nameOffsetX + horizontalVariation;
            this.nameText.y = startPosition.y - nameOffsetY + verticalVariation;
        }
        
        this.legMovement = 0;
    }
    
    destroy() {
        if (this.group) {
            this.group.destroy(true);
        }
    }
    
    finishRace(time) {
        this.finished = true;
        this.finishTime = time;
        this.scene.horseFinished(this);
        console.log(`Horse ${this.name} finished the race! (${this.scene.totalLaps} laps)`);
    }
}
