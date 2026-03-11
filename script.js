const { Engine, Render, Runner, World, Bodies, Events, Body, Composite, Vector, Vertices } = Matter;

// ゲーム設定
const width = 400;
const height = 600;

// エンジン作成
let engine;
let world;
let render;
let runner;

// ゲーム状態
let currentMode = 'normal';
let fruitQueue = [];
let canDrop = true;
let score = 0;
let isGameOver = false;
let deadLineY = 100; // ゲームオーバーライン (モードにより変化)

// 膨張モード用変数
let expansionTimer = 0;
let expansionScale = 1;
let isExpanding = false;
let lastExpansionScale = 1; // 前回のスケールを記録

const scoreElement = document.getElementById('score');
const currentFruitElement = document.getElementById('current-fruit-val');
const nextFruitElement = document.getElementById('next-fruit-val');
const modeSelect = document.getElementById('mode-select');
const restartBtn = document.getElementById('restart-btn');
const mathBtn = document.getElementById('math-btn');
const mathFullscreen = document.getElementById('math-fullscreen');

// 数学問題用変数
let currentMathProblems = [];
let isMathMode = false;

// フルーツの定義
const FRUITS = [
    { label: 'cherry', radius: 15, color: '#F00', score: 10, value: 1 },
    { label: 'strawberry', radius: 22, color: '#F55', score: 20, value: 2 },
    { label: 'grape', radius: 30, color: '#A0F', score: 30, value: 4 },
    { label: 'orange', radius: 38, color: '#FA0', score: 40, value: 8 },
    { label: 'persimmon', radius: 46, color: '#F80', score: 50, value: 16 },
    { label: 'apple', radius: 55, color: '#F22', score: 60, value: 32 },
    { label: 'pear', radius: 64, color: '#FF4', score: 70, value: 64 },
    { label: 'peach', radius: 73, color: '#FBB', score: 80, value: 128 },
    { label: 'pineapple', radius: 83, color: '#FF0', score: 90, value: 256 },
    { label: 'melon', radius: 93, color: '#8F8', score: 100, value: 512 },
    { label: 'watermelon', radius: 105, color: '#0A0', score: 110, value: 1024 },
    { label: 'super_watermelon', radius: 120, color: '#D4AF37', score: 120, value: 2048 },
];

function initGame() {
    if (render) {
        Render.stop(render);
        render.canvas.remove();
        render.canvas = null;
        render.context = null;
        render.textures = {};
    }
    if (runner) Runner.stop(runner);
    if (engine) {
        World.clear(engine.world);
        Engine.clear(engine);
    }

    engine = Engine.create();
    world = engine.world;
    world.isDark = false; // 暗転状態を初期化

    currentMode = modeSelect.value;

    // モードごとの設定
    if (currentMode === 'hard1') {
        engine.world.gravity.y = 0;
        engine.world.gravity.x = 0;
        deadLineY = -9999; // 無重力なのでライン判定なし
    } else if (currentMode === 'reverse') { // 逆重力
        engine.world.gravity.y = -1;
        deadLineY = height - 100; // 下の方にライン
    } else { // normal, hard2, hard4, pachinko, vector, change, darkness, expansion
        engine.world.gravity.y = 1;
        deadLineY = 100; // 上の方にライン
    }

    // パチンコモードはデッドラインを特別に設定
    if (currentMode === 'pachinko') {
        deadLineY = 450; // パチンコ台の下に設定
    }

    const canvasContainer = document.getElementById('canvas-container');
    canvasContainer.innerHTML = '';
    render = Render.create({
        element: canvasContainer,
        engine: engine,
        options: {
            width: width,
            height: height,
            wireframes: false,
            background: '#fceabb'
        }
    });

    const wallOptions = { isStatic: true, render: { fillStyle: '#8b4513' } };
    const walls = [];

    if (currentMode === 'hard1') {
        const thickness = 100;
        walls.push(Bodies.rectangle(-thickness/2, height/2, thickness, height * 2, { isStatic: true, render: { visible: false } }));
        walls.push(Bodies.rectangle(width + thickness/2, height/2, thickness, height * 2, { isStatic: true, render: { visible: false } }));
        walls.push(Bodies.rectangle(width/2, -thickness/2, width * 2, thickness, { isStatic: true, render: { visible: false } }));
        walls.push(Bodies.rectangle(width/2, height + thickness/2, width * 2, thickness, { isStatic: true, render: { visible: false } }));

        const centerCircle = Bodies.circle(width/2, height/2, 5, {
            isStatic: true,
            isSensor: true,
            render: { fillStyle: '#000' }
        });
        walls.push(centerCircle);
    } else {
        // 通常の壁（左右）
        walls.push(Bodies.rectangle(15, height / 2, 30, height, wallOptions));
        walls.push(Bodies.rectangle(width - 15, height / 2, 30, height, wallOptions));

        if (currentMode === 'reverse') { // 逆重力
            // 平らな天井
            walls.push(Bodies.rectangle(width / 2, 15, width, 30, wallOptions));
        } else {
            // 通常: 床を作る
            walls.push(Bodies.rectangle(width / 2, height - 15, width, 30, wallOptions));
        }
    }
    World.add(world, walls);

    // パチンコモードの釘
    if (currentMode === 'pachinko') {
        const pinRadius = 5;
        const pinOptions = { isStatic: true, render: { fillStyle: '#666' } };
        const pinRows = 10;
        const pinCols = 8; // 釘の列を減らして隙間を広げる
        const startY = 100;
        const xOffset = 40; // 左右のオフセットを増やして隙間を広げる
        const ySpacing = 40; // 行間の垂直方向の間隔を広げる
        const xSpacing = (width - xOffset * 2) / (pinCols - 1);

        for (let r = 0; r < pinRows; r++) {
            for (let c = 0; c < pinCols; c++) {
                let x = xOffset + c * xSpacing;
                if (r % 2 === 1) { // 互い違いに配置
                    x += xSpacing / 2;
                }
                const y = startY + r * ySpacing;
                if (x > xOffset && x < width - xOffset) { // 画面内に収める
                    walls.push(Bodies.circle(x, y, pinRadius, pinOptions));
                }
            }
        }
        World.add(world, walls);
    }


    setupEvents();

    score = 0;
    isGameOver = false;
    scoreElement.textContent = score;
    fruitQueue = [];
    canDrop = true;

    // 膨張モード用変数をリセット
    expansionTimer = 0;
    expansionScale = 1;
    isExpanding = false;
    lastExpansionScale = 1;

    fruitQueue.push(getNextFruitIndex());
    fruitQueue.push(getNextFruitIndex());
    updateNextFruitDisplay();

    runner = Runner.create();
    Runner.run(runner, engine);
    Render.run(render);
}

function getNextFruitIndex() {
    // シンプルにランダム
    return Math.floor(Math.random() * 5);
}

function createFruitBody(x, y, index) {
    const fruit = FRUITS[index];
    let body;

    const commonOptions = {
        label: fruit.label,
        restitution: 0.2,
        render: { fillStyle: fruit.color },
        fruitIndex: index
    };

    if (currentMode === 'hard2') {
        const size = fruit.radius;
        const shapeType = index % 6;

        if (shapeType === 0) {
            body = Bodies.circle(x, y, size, commonOptions);
        } else if (shapeType === 1) {
            body = Bodies.rectangle(x, y, size * 1.8, size * 1.8, {
                ...commonOptions,
                chamfer: { radius: 5 }
            });
        } else if (shapeType === 2) {
            body = Bodies.polygon(x, y, 3, size * 1.2, commonOptions);
        } else if (shapeType === 3) {
            body = Bodies.polygon(x, y, 5, size * 1.1, commonOptions);
        } else if (shapeType === 4) {
            body = Bodies.polygon(x, y, 7, size, commonOptions);
        } else {
            body = Bodies.trapezoid(x, y, size * 1.8, size * 1.8, 0.5, commonOptions);
        }
    } else {
        body = Bodies.circle(x, y, fruit.radius, commonOptions);
    }

    body.createdAt = Date.now();
    if (currentMode === 'hard4' && fruit.value === 1) {
        body.isExplosive = true;
    }

    // ベクトルモードで最初の瞬間にランダムな方向への力を加える
    if (currentMode === 'vector') {
        const isLeft = Math.random() < 0.5; // 左か右かランダム
        const angle = isLeft ? Math.PI * 3/4 : Math.PI / 4; // 左斜め下(135度)か右斜め下(45度)
        const forceMagnitude = 0.05 * body.mass;
        const force = {
            x: Math.cos(angle) * forceMagnitude,
            y: Math.sin(angle) * forceMagnitude
        };
        Body.applyForce(body, body.position, force);
    }

    // 暗転モードでランダムな暗転状態を設定
    if (currentMode === 'darkness') {
        // 画面全体の暗転状態をランダムに切り替える（復活の確率を低く）
        world.isDark = Math.random() < 0.8; // 80%の確率で暗転、20%で復活
    }

    return body;
}

function updateNextFruitDisplay() {
    if (fruitQueue.length < 2) return;
    const currentFruit = FRUITS[fruitQueue[0]];
    const nextFruit = FRUITS[fruitQueue[1]];

    currentFruitElement.textContent = currentFruit.value;
    currentFruitElement.style.backgroundColor = currentFruit.color;
    currentFruitElement.style.color = 'white';

    nextFruitElement.textContent = nextFruit.value;
    nextFruitElement.style.backgroundColor = nextFruit.color;
    nextFruitElement.style.color = 'white';
}

function setupEvents() {
    render.canvas.addEventListener('mousedown', (e) => {
        if (isGameOver) {
            initGame();
            return;
        }

        if (!canDrop) return;

        const rect = render.canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const currentFruitIndex = fruitQueue[0];
        const fruitData = FRUITS[currentFruitIndex];

        let spawnX = clickX;
        let spawnY = 50;

        if (currentMode === 'hard1') {
            spawnX = clickX;
            spawnY = clickY;
        } else if (currentMode === 'reverse') { // 逆重力
            spawnY = height - 50;
            const currentRadius = fruitData.radius;
            const minX = 30 + currentRadius;
            const maxX = width - 30 - currentRadius;
            spawnX = Math.max(minX, Math.min(clickX, maxX));
        } else { // normal, hard2, hard4, pachinko, vector, change, darkness, expansion
            const currentRadius = fruitData.radius;
            const minX = 30 + currentRadius;
            const maxX = width - 30 - currentRadius;
            spawnX = Math.max(minX, Math.min(clickX, maxX));
        }

        const fruit = createFruitBody(spawnX, spawnY, currentFruitIndex);
        World.add(world, fruit);

        canDrop = false;

        fruitQueue.shift();
        fruitQueue.push(getNextFruitIndex());
        updateNextFruitDisplay();

        setTimeout(() => {
            canDrop = true;
        }, 500);
    });

    Events.on(engine, 'collisionStart', (event) => {
        if (isGameOver) return;
        const pairs = event.pairs;
        for (let i = 0; i < pairs.length; i++) {
            const { bodyA, bodyB } = pairs[i];
            if (bodyA.fruitIndex !== undefined && bodyB.fruitIndex !== undefined &&
                bodyA.fruitIndex === bodyB.fruitIndex) {

                const index = bodyA.fruitIndex;
                if (index === FRUITS.length - 1) {
                     World.remove(world, [bodyA, bodyB]);
                     score += FRUITS[index].score * 4;
                     scoreElement.textContent = score;
                     continue;
                }

                const newX = (bodyA.position.x + bodyB.position.x) / 2;
                const newY = (bodyA.position.y + bodyB.position.y) / 2;

                World.remove(world, [bodyA, bodyB]);

                let newFruit;
                if (currentMode === 'change') {
                    // 変化モード：ランダムな数字のフルーツを生成
                    const randomIndex = Math.floor(Math.random() * FRUITS.length);
                    newFruit = createFruitBody(newX, newY, randomIndex);
                } else {
                    // 通常モード：次のレベルのフルーツを生成
                    newFruit = createFruitBody(newX, newY, index + 1);
                }
                World.add(world, newFruit);

                score += FRUITS[index].score * 2;
                scoreElement.textContent = score;

                bodyA.fruitIndex = -1;
                bodyB.fruitIndex = -1;
            }
        }
    });

    Events.on(engine, 'beforeUpdate', () => {
        if (isGameOver) return;

        const bodies = Composite.allBodies(world);
        const now = Date.now();

        // ベクトルモードは配置時のみ適用

        // 膨張モードのアニメーション
        if (currentMode === 'expansion') {
            expansionTimer++;
            
            // 5秒ごとに膨張アニメーションを開始
            if (expansionTimer > 300) { // 60fps * 5秒
                expansionTimer = 0;
                isExpanding = true;
            }
            
            // 膨張アニメーション（0.1秒で膨張、0.05秒待機、0.1秒で縮小）
            if (isExpanding) {
                if (expansionTimer <= 6) { // 0.1秒（6フレーム）
                    // 膨張フェーズ
                    expansionScale = 1.2; // 1.2倍に膨張
                } else if (expansionTimer <= 9) { // 0.15秒（9フレーム）
                    // 待機フェーズ（膨張状態を維持）
                    expansionScale = 1.2;
                } else if (expansionTimer <= 15) { // 0.25秒（15フレーム）
                    // 縮小フェーズ
                    expansionScale = 1; // 1倍に縮小
                } else {
                    // アニメーション完了
                    isExpanding = false;
                    expansionScale = 1;
                }
                
                // 全てのフルーツの物理サイズを変更
                for (const body of bodies) {
                    if (body.fruitIndex !== undefined && body.fruitIndex !== -1) {
                        const fruit = FRUITS[body.fruitIndex];
                        const scaleRatio = expansionScale / lastExpansionScale; // 相対的なスケール比
                        Body.scale(body, scaleRatio, scaleRatio);
                        body.circleRadius = fruit.radius * expansionScale;
                    }
                }
                lastExpansionScale = expansionScale;
            }
        }


        for (const body of bodies) {
            if (body.isStatic || body.isSensor) continue;

            // ベクトルモードで静止している玉に軽い浮力を与える
            if (currentMode === 'vector') {
                const velocity = Vector.magnitude(body.velocity);
                if (velocity < 0.1) { // 静止状態と見なす
                    // 軽い上向きの力を加えて宙に浮かせる
                    Body.applyForce(body, body.position, { x: 0, y: -0.002 * body.mass });
                }
            }

            // ゲームオーバー判定
            let isOverLine = false;
            if (currentMode === 'reverse') { // 逆重力
                if (body.position.y > deadLineY) isOverLine = true;
            } else if (currentMode !== 'hard1') {
                if (body.position.y < deadLineY) isOverLine = true;
            }

            if (isOverLine && now - body.createdAt > 2000) {
                // 爆発で吹き飛ばされた場合もゲームオーバー判定に含めるため速度チェックを削除
                isGameOver = true;
                Runner.stop(runner);
                return;
            }

            if (currentMode === 'hard1' && !body.isStatic) {
                const center = { x: width / 2, y: height / 2 };
                const forceMagnitude = 0.0005 * body.mass;
                const vector = Vector.sub(center, body.position);
                const normalized = Vector.normalise(vector);
                const force = Vector.mult(normalized, forceMagnitude);
                Body.applyForce(body, body.position, force);
            }

            if (currentMode === 'hard4' && body.isExplosive && body.fruitIndex === 0) {
                if (now - body.createdAt > 5000) {
                    bodies.forEach(other => {
                        if (other !== body && !other.isStatic) {
                            const forceMag = 0.15 * other.mass;
                            const vec = Vector.sub(other.position, body.position);
                            const dist = Vector.magnitude(vec);
                            if (dist < 500) {
                                const norm = Vector.normalise(vec);
                                const force = Vector.mult(norm, forceMag / (dist * 0.005 + 1));
                                Body.applyForce(other, other.position, force);
                            }
                        }
                    });

                    World.remove(world, body);

                    const canvas = render.canvas;
                    canvas.style.transform = `translate(${Math.random()*10-5}px, ${Math.random()*10-5}px)`;
                    setTimeout(() => { canvas.style.transform = 'none'; }, 100);
                }
            }
        }
    });

    Events.on(render, 'afterRender', () => {
        const context = render.context;
        const now = Date.now();

        // デッドライン描画
        if (currentMode !== 'hard1') {
            context.beginPath();
            context.moveTo(0, deadLineY);
            context.lineTo(width, deadLineY);
            context.strokeStyle = 'rgba(255, 0, 0, 0.5)';
            context.lineWidth = 2;
            context.setLineDash([5, 5]);
            context.stroke();
            context.setLineDash([]);
        }

        context.fillStyle = "white";
        context.textAlign = "center";
        context.textBaseline = "middle";

        const bodies = Composite.allBodies(world);
        bodies.forEach(body => {
            if (body.fruitIndex !== undefined && body.fruitIndex !== -1) {
                const fruit = FRUITS[body.fruitIndex];

                const fontSize = Math.max(12, fruit.radius * 0.7);
                context.font = `bold ${fontSize}px Arial`;
                context.fillText(fruit.value, body.position.x, body.position.y);

                if (currentMode === 'hard4' && body.isExplosive) {
                    const timeLeft = Math.max(0, 5000 - (now - body.createdAt));
                    const seconds = (timeLeft / 1000).toFixed(1);
                    context.fillStyle = "red";
                    context.font = "bold 14px Arial";
                    context.fillText(seconds, body.position.x, body.position.y + 20);
                    context.fillStyle = "white";
                }
            }
        });

        // 暗転モードの画面暗転効果
        if (currentMode === 'darkness' && world.isDark) {
            context.fillStyle = "black";
            context.fillRect(0, 0, width, height);
        }

        // ゲームオーバー表示
        if (isGameOver) {
            context.fillStyle = "rgba(0, 0, 0, 0.7)";
            context.fillRect(0, 0, width, height);

            context.fillStyle = "white";
            context.font = "bold 40px Arial";
            context.fillText("GAME OVER", width / 2, height / 2);

            context.font = "bold 20px Arial";
            context.fillText("Click to Restart", width / 2, height / 2 + 50);
        }
    });
}

function generateMathProblem() {
    const problemTypes = [
        'quadratic',      // 二次方程式
        'trigonometry',  // 三角関数
        'logarithm',     // 対数
        'exponential',   // 指数
        'derivative'      // 微分
    ];
    
    currentMathProblems = [];
    
    // 5問生成
    for (let i = 0; i < 5; i++) {
        const type = problemTypes[Math.floor(Math.random() * problemTypes.length)];
        let problem = '';
        
        switch (type) {
            case 'quadratic':
                const a = Math.floor(Math.random() * 5) + 1;
                const b = Math.floor(Math.random() * 10) - 5;
                const c = Math.floor(Math.random() * 10) - 5;
                problem = `${a}x² + ${b}x + ${c} = 0`;
                break;
                
            case 'trigonometry':
                const angle = Math.floor(Math.random() * 90) + 1;
                const trigFunc = ['sin', 'cos', 'tan'][Math.floor(Math.random() * 3)];
                problem = `${trigFunc}(${angle}°) = ?`;
                break;
                
            case 'logarithm':
                const base = Math.floor(Math.random() * 5) + 2;
                const value = Math.floor(Math.random() * 20) + 1;
                problem = `log_${base}(${value}) = ?`;
                break;
                
            case 'exponential':
                const expBase = Math.floor(Math.random() * 3) + 2;
                const exponent = Math.floor(Math.random() * 4) + 1;
                problem = `${expBase}^${exponent} = ?`;
                break;
                
            case 'derivative':
                const coeff = Math.floor(Math.random() * 5) + 1;
                const power = Math.floor(Math.random() * 4) + 1;
                problem = `d/dx(${coeff}x^${power}) = ?`;
                break;
        }
        
        currentMathProblems.push(problem);
    }
    
    showMathProblems();
}

function showMathProblems() {
    isMathMode = true;
    
    // 数学モードのクラスを追加
    document.body.classList.add('math-mode');
    
    // 全画面表示
    mathFullscreen.classList.remove('hidden');
    
    // 5問を表示
    for (let i = 0; i < 5; i++) {
        const problemElement = document.getElementById(`problem-${i + 1}`);
        if (problemElement) {
            problemElement.textContent = `${i + 1}. ${currentMathProblems[i]}`;
        }
    }
}

function hideMathProblems() {
    isMathMode = false;
    
    // 数学モードのクラスを削除
    document.body.classList.remove('math-mode');
    
    // 全画面表示を隠す
    mathFullscreen.classList.add('hidden');
    
    currentMathProblems = [];
}

// 数学ボタンのイベントリスナー
mathBtn.addEventListener('click', generateMathProblem);

// キー入力で数学問題を隠す
document.addEventListener('keydown', (e) => {
    if (isMathMode) {
        hideMathProblems();
    }
});

// マウス入力で数学問題を隠す
document.addEventListener('mousedown', (e) => {
    if (isMathMode && e.target !== mathBtn) {
        hideMathProblems();
    }
});

restartBtn.addEventListener('click', () => {
    initGame();
});

initGame();