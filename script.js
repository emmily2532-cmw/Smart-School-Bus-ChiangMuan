// ==========================================
// 🔴 ใส่ URL Web App ของ Google Sheets ที่นี่
// ==========================================
const GOOGLE_APP_URL = "https://script.google.com/macros/s/AKfycbyceO8xYIfmc2vbz4rKiI4_CT3TUreAUGuXGoXUuR4C1WIg5QNSPzXAtQR9HDHOJG0t/exec";
// ==========================================

const video = document.getElementById('video');
let isScanningAllowed = true;

// 1. โหลดโมเดล AI (โหลดผ่านอินเทอร์เน็ต CDN)
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
            
            // ซ่อนหน้าจอล็อกเมื่อเปิดกล้องสำเร็จ
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

    // ประมวลผลทุกๆ 1 วินาที ลดอาการมือถือค้าง
    setInterval(async () => {
        const detections = await faceapi.detectAllFaces(video).withFaceLandmarks().withFaceDescriptors();
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);

        const results = resizedDetections.map(d => faceMatcher.findBestMatch(d.descriptor));
        
        results.forEach((result, i) => {
            const box = resizedDetections[i].detection.box;
            const drawBox = new faceapi.draw.DrawBox(box, { label: result.toString() });
            drawBox.draw(canvas);

            // หากเจอใบหน้าที่ตรงกับในฐานข้อมูล และอยู่ในสถานะพร้อมสแกน
            if (result.label !== 'unknown' && isScanningAllowed) {
                isScanningAllowed = false; // ล็อกการสแกนทันที ป้องกันส่งซ้ำ
                
                let studentName = result.label;
                document.getElementById('scan-status').innerText = "✅ เช็คชื่อสำเร็จ: " + studentName;
                
                // ยิงข้อมูลชื่อและสถานะไปเก็บบน Google Sheets
                fetch(GOOGLE_APP_URL + "?student_name=" + studentName + "&status=boarded")
                    .then(response => console.log("บันทึกข้อมูล " + studentName + " สำเร็จ!"));

                // หน่วงเวลา 10 วินาทีก่อนเริ่มสแกนคนต่อไป
                setTimeout(() => { 
                    isScanningAllowed = true; 
                    document.getElementById('scan-status').innerText = "✅ กล้องพร้อม! รอสแกนคนต่อไป..."; 
                }, 10000);
            }
        });
    }, 1000); 
});

// 4. โหลดรูปภาพต้นแบบนักเรียน (ปรับให้ยืดหยุ่นขึ้น)
function loadLabeledImages() {
    const labels = [
        'นางสาวจุฑาทิพย์_เทพน้อย',
        'นางสาวฐิตารีย์_เกตุวีระพงศ์',
        'นายนราวิชญ์_วงค์นนทิ',
        'นายภูมินทร์_ยะแสง',
        'นายวชิรวิทย์_ชาวน่าน',
        'นายศุกลวัฒน์_กวนฮางฮอง'
    ]; 
    
    return Promise.all(
        labels.map(async label => {
            const descriptions = [];
            for (let i = 1; i <= 3; i++) { 
                try {
                    const img = await faceapi.fetchImage(`./labeled_images/${label}/${i}.jpg`);
                    const detections = await faceapi.detectSingleFace(img).withFaceLandmarks().withFaceDescriptor();
                    
                    // ถ้าตรวจเจอหน้า ให้เก็บข้อมูล ถ้าไม่เจอก็ให้ข้ามไป ไม่ทำให้โปรแกรมค้าง
                    if (detections) {
                        descriptions.push(detections.descriptor);
                    }
                } catch (error) {
                    console.log(`ไม่พบไฟล์หรือตรวจไม่พบหน้าในไฟล์: ${label}/${i}.jpg`);
                }
            }
            return new faceapi.LabeledFaceDescriptors(label, descriptions);
        })
    );
}
