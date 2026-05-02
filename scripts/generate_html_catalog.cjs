const fs = require('fs');

const catalog = JSON.parse(fs.readFileSync('catalog_dump.json', 'utf8'));
const categoriesOrder = ["Pecho", "Dorsal", "Bíceps", "Tríceps", "Hombro", "Pierna", "Glúteo", "Abdomen"];

const grouped = {};
categoriesOrder.forEach(cat => grouped[cat] = []);
catalog.forEach(ex => {
    if (grouped[ex.category]) grouped[ex.category].push(ex);
    else {
        if (!grouped[ex.category]) grouped[ex.category] = [];
        grouped[ex.category].push(ex);
    }
});

// Sort each category by ID
Object.keys(grouped).forEach(cat => {
    grouped[cat].sort((a,b) => a.id - b.id);
});

let tableRows = '';
let totalCount = catalog.length;

categoriesOrder.forEach(cat => {
    if (grouped[cat] && grouped[cat].length > 0) {
        // Optional: Add a section header for each category
        tableRows += `<tr><td colspan="4" class="section-header">${cat}</td></tr>`;
        
        grouped[cat].forEach(ex => {
            const imgPath = ex.image_url.startsWith('/') ? '.' + ex.image_url : ex.image_url;
            tableRows += `
        <tr>
            <td class="id-cell">#${ex.id}</td>
            <td>
                <img src="${imgPath}" class="exercise-img" alt="${ex.name}" onerror="this.src='https://via.placeholder.com/120x80/222/ff0000?text=Error'">
            </td>
            <td><strong>${ex.name}</strong></td>
            <td><span class="category-badge">${ex.category}</span></td>
        </tr>`;
        });
    }
});

const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Catálogo Maestro de Ejercicios - Futures Gym</title>
    <style>
        :root {
            --primary: #c0ff00; /* Lime green neon */
            --secondary: #9d00ff; /* Purple neon */
            --bg: #050505;
            --card-bg: #111;
            --text: #eee;
            --border: #333;
        }

        body {
            font-family: 'Inter', -apple-system, sans-serif;
            background-color: var(--bg);
            color: var(--text);
            margin: 0;
            padding: 20px;
            line-height: 1.6;
        }

        header {
            text-align: center;
            padding: 40px 0;
            border-bottom: 2px solid var(--border);
            margin-bottom: 40px;
        }

        h1 {
            font-size: 2.5rem;
            margin: 0;
            background: linear-gradient(45deg, var(--primary), var(--secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            text-transform: uppercase;
            letter-spacing: 2px;
        }

        .stats {
            display: flex;
            justify-content: center;
            gap: 20px;
            margin-top: 10px;
            font-size: 0.9rem;
            color: #888;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            background: var(--card-bg);
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            margin-bottom: 40px;
        }

        th {
            background: #1a1a1a;
            color: var(--primary);
            text-align: left;
            padding: 15px;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 1px;
            border-bottom: 2px solid var(--border);
        }

        td {
            padding: 15px;
            border-bottom: 1px solid var(--border);
            vertical-align: middle;
        }

        tr:hover {
            background: #181818;
        }

        .exercise-img {
            width: 120px;
            border-radius: 8px;
            border: 1px solid #444;
            transition: transform 0.2s;
            cursor: zoom-in;
        }

        .exercise-img:hover {
            transform: scale(2.5);
            z-index: 100;
            position: relative;
            border-color: var(--primary);
        }

        .category-badge {
            padding: 4px 10px;
            border-radius: 20px;
            font-size: 0.75rem;
            font-weight: bold;
            background: rgba(157, 0, 255, 0.2);
            color: var(--secondary);
            border: 1px solid var(--secondary);
            text-transform: uppercase;
        }

        .id-cell {
            font-family: 'Courier New', Courier, monospace;
            color: var(--primary);
            font-weight: bold;
            font-size: 1.1rem;
        }

        .section-header {
            background: #1a1a1a;
            color: var(--primary);
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 2px;
            padding: 20px;
            font-size: 1.2rem;
            border-left: 4px solid var(--primary);
        }

        .actions {
            position: fixed;
            bottom: 20px;
            right: 20px;
            display: flex;
            gap: 10px;
        }

        .btn {
            background: var(--primary);
            color: black;
            border: none;
            padding: 10px 20px;
            border-radius: 8px;
            font-weight: bold;
            cursor: pointer;
            text-decoration: none;
        }

        .search-bar {
            max-width: 500px;
            margin: 0 auto 30px;
            display: flex;
            align-items: center;
            background: var(--card-bg);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 10px 20px;
        }

        .search-bar input {
            background: transparent;
            border: none;
            color: white;
            font-size: 1rem;
            width: 100%;
            outline: none;
        }

        /* Modal Image Styles */
        .image-modal {
            display: none;
            position: fixed;
            z-index: 1000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(5, 5, 5, 0.95);
            justify-content: center;
            align-items: center;
            backdrop-filter: blur(5px);
        }

        .image-modal-content {
            max-width: 90%;
            max-height: 90vh;
            border: 2px solid var(--primary);
            border-radius: 12px;
            box-shadow: 0 0 40px rgba(192, 255, 0, 0.2);
            object-fit: contain;
            animation: zoomIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
        }

        @keyframes zoomIn {
            from { transform: scale(0.8); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
        }

        .close-modal {
            position: absolute;
            top: 20px;
            right: 30px;
            color: var(--text);
            font-size: 40px;
            font-weight: bold;
            cursor: pointer;
            transition: color 0.2s;
            z-index: 1001;
        }

        .close-modal:hover {
            color: var(--primary);
        }
    </style>
</head>
<body>

<header>
    <h1>Catálogo Maestro</h1>
    <div class="stats">
        <span>Total Ejercicios: <strong id="total-count">${totalCount}</strong></span>
        <span>Última Actualización: <strong>${new Date().toLocaleDateString('es-ES')}</strong></span>
    </div>
</header>

<div class="search-bar">
    <input type="text" id="searchInput" placeholder="Buscar por ID, nombre o categoría..." onkeyup="filterTable()">
</div>

<table>
    <thead>
        <tr>
            <th>ID</th>
            <th>Imagen</th>
            <th>Nombre</th>
            <th>Categoría</th>
        </tr>
    </thead>
    <tbody id="exerciseTableBody">
        ${tableRows}
    </tbody>
</table>

<div class="actions">
    <a href="#" class="btn" onclick="window.scrollTo(0,0)">↑ Volver Arriba</a>
</div>

<!-- Modal Overlay for Images -->
<div id="imageModal" class="image-modal">
    <span class="close-modal">&times;</span>
    <img class="image-modal-content" id="modalImage">
</div>

<script>
// Image Modal Logic
document.addEventListener("DOMContentLoaded", function() {
    const modal = document.getElementById("imageModal");
    const modalImg = document.getElementById("modalImage");
    const closeBtn = document.querySelector(".close-modal");

    // Add click event to all exercise images
    document.querySelectorAll(".exercise-img").forEach(img => {
        img.addEventListener("click", function() {
            modal.style.display = "flex";
            modalImg.src = this.src;
        });
    });

    // Close modal on close button click
    closeBtn.addEventListener("click", function() {
        modal.style.display = "none";
    });

    // Close modal on click outside image
    modal.addEventListener("click", function(e) {
        if (e.target === modal) {
            modal.style.display = "none";
        }
    });
    
    // Close modal on escape key
    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape" && modal.style.display === "flex") {
            modal.style.display = "none";
        }
    });
});

function filterTable() {
    const input = document.getElementById("searchInput");
    const filter = input.value.toUpperCase();
    const tbody = document.getElementById("exerciseTableBody");
    const tr = tbody.getElementsByTagName("tr");
    let visibleCount = 0;

    for (let i = 0; i < tr.length; i++) {
        const tdId = tr[i].getElementsByTagName("td")[0];
        const tdName = tr[i].getElementsByTagName("td")[2];
        const tdCat = tr[i].getElementsByTagName("td")[3];
        
        if (tdId && tdName && tdCat) {
            const txtId = tdId.textContent || tdId.innerText;
            const txtName = tdName.textContent || tdName.innerText;
            const txtCat = tdCat.textContent || tdCat.innerText;
            
            // Skip section headers
            if (tr[i].cells.length === 1) {
                // If filtering, we might want to hide category headers, or show them only if they have visible children
                // For now, let's just hide them if there's a filter
                tr[i].style.display = filter ? "none" : "";
                continue;
            }

            if (txtId.toUpperCase().indexOf(filter) > -1 || 
                txtName.toUpperCase().indexOf(filter) > -1 ||
                txtCat.toUpperCase().indexOf(filter) > -1) {
                tr[i].style.display = "";
                visibleCount++;
            } else {
                tr[i].style.display = "none";
            }
        }
    }
    document.getElementById("total-count").innerText = visibleCount;
}
</script>

</body>
</html>`;

fs.writeFileSync('EJERCICIOS_CATALOGO.html', htmlContent);
console.log('Catálogo HTML regenerado con éxito.');
