// engine.js — enemigos normales + bosses de apertura
//---------------------------------------------------
const boardEngine = (() => {

  /* -------- estado interno -------- */
  const gridEl   = document.getElementById('grid');
  const monsters = [];
  const incoming = [];          // objetos {x,y,type}
  let   boss     = null;

  const exports = { rookExtra:0, pawnFast:false };

  /* -------- utilidades básicas -------- */
  const rnd  = n => Math.floor(Math.random() * n);

  const isMonster = (x, y) => monsters.some(m => m.x === x && m.y === y);
  const hitHero   = (x, y) => isMonster(x, y) || (boss && boss.x === x && boss.y === y);
  const ocp       = (x, y) => isMonster(x, y) || (boss && boss.x === x && boss.y === y);

  const mark = (x, y, on) =>
    gridEl.children[y * GRID + x].classList.toggle('forecast', on);

  /* -------- casilla libre -------- */
  function randomFreeCell(blocked = []) {
    const bad = p => blocked.some(b => b.x === p.x && b.y === p.y) || ocp(p.x, p.y);
    let p;
    do { p = { x: rnd(GRID), y: rnd(GRID) }; } while (bad(p));
    return p;
  }

  /* -------- helpers de forecast / desmontaje -------- */
  function unmarkPlan(m) {
    if (m.type === 'r' && m.plan) m.plan.forEach(p => mark(p.x, p.y, false));
  }

  /* -------- montaje / desmontaje -------- */
  function addMonster(m, boardEl) {
    if (m.type === 'r') m.plan = [];
    monsters.push(m);
    boardEl.appendChild(m.el);
  }

  function queueSpawn(type,x,y){
    incoming.push({x,y,type});
    gridEl.children[y*GRID+x].classList.add('incoming');
  }

  function removeMonster(i) {
    unmarkPlan(monsters[i]);
    monsters[i].el.remove();
    monsters.splice(i, 1);
  }

  function reset() {
     // quita cualquier marca de boss/torre que pudiera quedar
     gridEl.querySelectorAll('.forecast').forEach(c=>c.classList.remove('forecast'));
    monsters.forEach(m => { unmarkPlan(m); m.el.remove(); });
    monsters.length = 0;
    if (boss) { boss.el.remove(); boss = null; }

    incoming.forEach(s=>gridEl.children[s.y*GRID+s.x].classList.remove('incoming'));
    incoming.length = 0;
  }

  /* -------- IA de enemigos normales -------- */
  function stepMonsters(hero) {
    monsters.forEach(m => {
      if (m.type === 'b') {                           // alfil
        const dx = Math.sign(hero.x - m.x),
              dy = Math.sign(hero.y - m.y);
        if (dx && dy && !ocp(m.x + dx, m.y + dy)) { m.x += dx; m.y += dy; }

      } else if (m.type === 'r') {                    // torre 2 fases
        if (m.phase === 0) {
          const horiz = Math.abs(hero.x - m.x) >= Math.abs(hero.y - m.y);
          const dir   = horiz ? { x: Math.sign(hero.x - m.x), y: 0 }
                              : { x: 0,                      y: Math.sign(hero.y - m.y) };
        const rng = 2 + (exports.rookExtra||0);      // 3 con reliquia
          m.plan = [
          { x: m.x + dir.x,     y: m.y + dir.y     },
          { x: m.x + dir.x*rng, y: m.y + dir.y*rng }
          ];
          m.plan.forEach(p => mark(p.x, p.y, true));
          m.phase = 1;
        } else {
          m.plan.forEach(p => mark(p.x, p.y, false));
          const d = m.plan[1];
          if (!ocp(d.x, d.y)) { m.x = d.x; m.y = d.y; }
          m.phase = 0;
        }

      } else {
        const speed = 1 + (exports.pawnFast?1:0);                                        // peón rastreador
        const dx  = hero.x - m.x,
              dy  = hero.y - m.y;
        const dir = Math.abs(dx) >= Math.abs(dy)
                    ? { x: Math.sign(dx), y: 0 }
                    : { x: 0,            y: Math.sign(dy) };
                    if (!ocp(m.x + dir.x*speed, m.y + dir.y*speed)){
                      m.x += dir.x*speed; m.y += dir.y*speed;
                 }
      }
    });
  }

  /* ---------------- bosses ---------------- */
    function spawnBoss(floor, boardEl, hero) {
          const pos = randomFreeCell([hero, ...monsters]);
        /** identificador que usará advance() para instanciarlo */
     const id = (floor === 2) ? 'bossQ' : 'bossB';
        /* ① sólo lo telegrafiamos: */
      queueSpawn(id, pos.x, pos.y);
         /* ② anillo rojo de advertencia */
      if (window.spawnFx) spawnFx('fx-boss', pos.x, pos.y, 600);
}

  /* Queen – Gambito de Dama (floor 3) */
  function createQueenBoss(pos, boardEl) {
    boss = {
      x: pos.x, y: pos.y,
        cool: 3, hp: 4, maxHp: 4,
      sprite: 'bossQ', type: 'queenBoss',
      step(hero) {
        const dx = Math.sign(hero.x - boss.x),
              dy = Math.sign(hero.y - boss.y);
        const nx = boss.x + dx, ny = boss.y + dy;
        if (!ocp(nx, ny)) { boss.x = nx; boss.y = ny; }

        if (--boss.cool === 0) {                     // clona un peón adyacente
          const adj = [
            { x: boss.x + 1, y: boss.y },
            { x: boss.x - 1, y: boss.y },
            { x: boss.x,     y: boss.y + 1 },
            { x: boss.x,     y: boss.y - 1 }
          ].filter(p => p.x >= 0 && p.y >= 0 && p.x < GRID && p.y < GRID && !ocp(p.x, p.y));

          if (adj.length) {
            const p = adj[rnd(adj.length)];
            // efecto visual del spawn
            if (window.spawnFx) window.spawnFx('fx-spawn', p.x, p.y);
            const m = { x: p.x, y: p.y, type: 'p', phase: 0 };
            m.el = document.createElement('div');
            m.el.className = 'sprite p';
            boardEl.appendChild(m.el);
            monsters.push(m);
          }
          boss.cool = 3;
        }
      }
    };
    boss.el = document.createElement('div');
    boss.el.className = 'sprite ' + boss.sprite;
    boardEl.appendChild(boss.el);

    // anillo de spawn del Boss Reina
    if (window.spawnFx) window.spawnFx('fx-boss', boss.x, boss.y, 600);
  }

  /* Bishop Dragón (floor 5) */
  function createDragonBoss(pos, boardEl) {
    boss = {
      x: pos.x, y: pos.y, charge: 0, hp: 5, maxHp: 5,
      sprite: 'bossB', type: 'dragonBoss', diag: [],
      step(hero) {
        const dx = Math.sign(hero.x - boss.x),
              dy = Math.sign(hero.y - boss.y);
        if (dx && dy && !ocp(boss.x + dx, boss.y + dy)) { boss.x += dx; boss.y += dy; }

        if (boss.charge === 0) {             // telegrafía
          boss.diag = diagonals(boss.x, boss.y);
          boss.diag.forEach(p => mark(p.x, p.y, true));
          boss.charge = 1;
        } else {                             // dispara
          boss.diag.forEach(p => mark(p.x, p.y, false));
          // destello sobre cada casilla disparada
         boss.diag.forEach(p => {
           if (window.spawnFx) window.spawnFx('fx-dragon', p.x, p.y, 550);
         });
          if (boss.diag.some(p => p.x === hero.x && p.y === hero.y))
               document.getElementById('overlay').classList.add('show');
          boss.diag = [];
          boss.charge = 0;
        }
      }
    };
    boss.el = document.createElement('div');
    boss.el.className = 'sprite ' + boss.sprite;
    boardEl.appendChild(boss.el);

     // anillo de spawn del Boss Dragón
     if (window.spawnFx) window.spawnFx('fx-boss', boss.x, boss.y, 600);

    function diagonals(x, y) {
      const out = [];
      [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dx,dy]) => {
        let cx = x + dx, cy = y + dy;
        while (cx >= 0 && cy >= 0 && cx < GRID && cy < GRID) {
          out.push({ x: cx, y: cy }); cx += dx; cy += dy;
        }
      });
      return out;
    }
  }

  /* -------- ciclo enemigo -------- */
  const advance = hero => {
    /* fase 1: mueven los enemigos presentes */
    stepMonsters(hero);
    boss && boss.step(hero);
  
    /* fase 2: materializan los programados */
    for(let i=incoming.length-1;i>=0;i--){
       const s=incoming[i];
       gridEl.children[s.y*GRID+s.x].classList.remove('incoming');
  
       /* ¿pisa al héroe? */
       if(hero.x===s.x && hero.y===s.y){
          document.getElementById('overlay').classList.add('show');
          return;
       }
       if (s.type === 'bossQ'){ createQueenBoss({x:s.x,y:s.y}, gridEl.parentElement); }
       else if (s.type === 'bossB'){ createDragonBoss({x:s.x,y:s.y}, gridEl.parentElement); }
       else{
      const cls = {p:'p',b:'b',r:'r'}[s.type];
      const m   = {x:s.x,y:s.y,type:s.type,phase:0};
      m.el = document.createElement('div');
      m.el.className = 'sprite '+cls;
      gridEl.parentElement.appendChild(m.el);
      monsters.push(m);
       }
       incoming.splice(i, 1); // eliminar de la cola
      }
  };

  /* -------- movimientos del héroe -------- */
  function line(p, dx, dy, s) {
    const r = [];
    let x = p.x + dx, y = p.y + dy;
    while (x >= 0 && y >= 0 && x < s && y < s) { r.push({ x, y }); x += dx; y += dy; }
    return r;
  }

  function heroMoves(pos, size, card = 'knight') {
    switch (card) {
      case 'king':
        return [-1,0,1].flatMap(dx =>
               [-1,0,1].map(dy => ({ x: pos.x + dx, y: pos.y + dy })))
               .filter(p => (p.x !== pos.x || p.y !== pos.y) &&
                            p.x >= 0 && p.y >= 0 && p.x < size && p.y < size);

      case 'queen':
        return [...heroMoves(pos, size, 'rook'),
                ...heroMoves(pos, size, 'bishop')];

      case 'rook':
        return [...line(pos,  1, 0, size), ...line(pos, -1, 0, size),
                ...line(pos,  0, 1, size), ...line(pos,  0,-1, size)];

      case 'bishop':
        return [...line(pos,  1, 1, size), ...line(pos, -1, 1, size),
                ...line(pos,  1,-1, size), ...line(pos, -1,-1, size)];

      case 'pawn': {
        const out = [];
        if (pos.y > 0)                  out.push({ x: pos.x,     y: pos.y - 1 }); // avanzar
        if (pos.y > 0 && pos.x > 0)     out.push({ x: pos.x - 1, y: pos.y - 1 }); // captura izq
        if (pos.y > 0 && pos.x < size-1)out.push({ x: pos.x + 1, y: pos.y - 1 }); // captura dcha
        return out;
      }

      default: {                        // knight
        const k = [[ 1, 2],[ 2, 1],[-1, 2],[-2, 1],
                   [ 1,-2],[ 2,-1],[-1,-2],[-2,-1]];
        return k.map(d => ({ x: pos.x + d[0], y: pos.y + d[1] }))
                .filter(p => p.x >= 0 && p.y >= 0 && p.x < size && p.y < size);
      }
    }
  }

  /* -------- bomba -------- */
  function explodeBomb(cx, cy) {

    // 1️⃣  radio dinámico
    const range  = Math.max(0, 1 + (exports.bombRange ?? 0));
  
    // 2️⃣  daño dinámico
    const dmgBoss = 1 + (exports.bombExtra ?? 0);
  
    // ---- monstruos ------------------------------------------------
    for (let i = monsters.length - 1; i >= 0; i--)
        if (Math.abs(monsters[i].x - cx) <= range &&
            Math.abs(monsters[i].y - cy) <= range)
            removeMonster(i);
  
    // ---- jefe -----------------------------------------------------
    if (boss &&
        Math.abs(boss.x - cx) <= range &&
        Math.abs(boss.y - cy) <= range)
          damageBoss(dmgBoss);
  }

  /* -------- redraw -------- */
  const redrawSprites = () => {
    monsters.forEach(m => { m.el.style.left = m.x * TILE + 'px'; m.el.style.top = m.y * TILE + 'px'; });
    if (boss) { boss.el.style.left = boss.x * TILE + 'px'; boss.el.style.top = boss.y * TILE + 'px'; }
  };

  function damageBoss(dmg){
    if(!boss) return false;
    boss.hp -= dmg;
    if(boss.hp <= 0){
      boss.el.remove();
      boss = null;
      return true;                 // murió
    }
    return false;
  }
  

  /* -------- API pública -------- */
  return {
       damageBoss,
       queueSpawn,
       
    
    /* checks */
    isOcupied : ocp,
    hitHero,

    /* colecciones */
    monsters,
    get boss() { return boss; },
    allPieces  : () => [...monsters, boss].filter(Boolean),

    /* gestión */
    addMonster, randomFreeCell, reset, spawnBoss,
    explodeBomb, advance, redrawSprites,

    /* util del héroe */
    heroMoves,
    exports  
  };

})();
