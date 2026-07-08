// ==========================================
// 🔴 ใส่ URL Web App ของ Google Sheets ที่นี่
// ==========================================
const GOOGLE_APP_URL = "https://script.google.com/macros/s/AKfycbyceO8xYIfmc2vbz4rKiI4_CT3TUreAUGuXGoXUuR4C1WIg5QNSPzXAtQR9HDHOJG0t/exec";
// ==========================================

const video = document.getElementById('video');
let isScanningAllowed = true;

// 1. โหลดโมเดล AI
Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'),
    faceapi.nets.faceRecognitionNet.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights'),
    faceapi.nets.faceLandmark68Net.loadFromUri('https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights')
]).then(startVideo);

// 2. ฟังก์ชันเปิดกล้อง (บังคับกล้องหน้า และ ปลดล็อกหน้าจอ)
function startVideo() {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } })
        .then(stream => { 
            video.srcObject = stream; 
            
            // ✅ จุดสำคัญ: เมื่อกล้องเปิดสำเร็จ ให้ซ่อนหน้าจอล็อก และโชว์เว็บหลัก
            const cameraGate = document.getElementById('camera-gate');
            const mainContent = document.getElementById('main-content');
            
            if(cameraGate) cameraGate.style.display = 'none'; 
            if(mainContent) mainContent.style.display = 'block';
        })
        .catch(err => {
            console.error("ไม่สามารถเปิดกล้องได้: ", err);
            alert("⚠️ ไม่สามารถเข้าสู่ระบบได้ กรุณาอนุญาตให้ใช้งานกล้องหน้าครับ");
        });
}

// 3. เริ่มสแกนเมื่อวิดีโอเล่น
video.addEventListener('play', async () => {
    document.getElementById('scan-status').innerText = "✅ กล้องพร้อม! เริ่มสแกนได้เลย";
    document.getElementById('scan-status').style.color = "#1abc9c";

    const labeledFaceDescriptors = await loadLabeledImages();
    const faceMatcher = new faceapi.FaceMatcher(labeledFaceDescriptors, 0.6);

    const canvas = document.getElementById('overlay');
    const displaySize = { width: video.videoWidth, height: video.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    // ปรับความเร็วเป็น 1000ms (1 วินาที) เพื่อไม่ให้มือถือค้าง
    setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video).withFaceLandmarks().withFaceDescriptors();
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

        const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor));
        
        results.forEach((result, i) => {
            const box = resizedDetections[i].detection.box;
            const drawBox = new faceapi.draw.DrawBox(box, { label: result.toString() });
            drawBox.draw(canvas);

            if (result.label !== 'unknown' && isScanningAllowed) {
                isScanningAllowed = false; 
                
                let studentName = result.label;
                document.getElementById('scan-status').innerText = "✅ เช็คชื่อสำเร็จ: " + studentName;
                
                // ยิงข้อมูลไป Google Sheets
                fetch(GOOGLE_APP_URL + "?student_name=" + studentName + "&status=boarded")
                    .then(response => console.log("บันทึกข้อมูล " + studentName + " สำเร็จ!"));

                setTimeout(() => { 
                    isScanningAllowed = true; 
                    document.getElementById('scan-status').innerText = "✅ กล้องพร้อม! รอสแกนคนต่อไป..."; 
                }, 5000);
            }
        });
    }, 1000); 
});

// 4. โหลดรูปภาพต้นแบบ (อย่าลืมแก้ชื่อโฟลเดอร์ภาษาไทยตรงนี้ถ้ามีการเปลี่ยนนะครับ)
function loadLabeledImages() {
    const labels = ['Chuthathip']; // <--- ใส่ชื่อให้ตรงกับโฟลเดอร์ใน labeled_images
    
    return Promise.all(
        labels.map(async label => {
            const descriptions = [];
            for (let i = 1; i <= 2; i++) { 
                const img = await faceapi.fetchImage(`./labeled_images/${label}/${i}.jpg`);
                const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
                descriptions.push(detections.descriptor);
            }
            return new faceapi.LabeledFaceDescriptors(label, descriptions);
        })
    );
}
