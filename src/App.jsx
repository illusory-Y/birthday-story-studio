import { useEffect, useMemo, useRef, useState } from 'react'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import {
  ArrowLeft, ArrowRight, ArrowDown, ArrowUp, BadgeCheck, CakeSlice, ChevronDown,
  Clapperboard, Download, FileDown, FileUp, FolderOpen, ImagePlus, Import,
  Layers3, Maximize2, Pause, Play, Plus, Rocket, RotateCcw, Settings2,
  Share2, Sparkles, Star, Trash2, Upload, Volume2, VolumeX, WandSparkles, X,
} from 'lucide-react'
import ThreeCelebration from './components/ThreeCelebration.jsx'

const STORAGE_KEY = 'birthday-rr-project-v2'
const DB_NAME = 'birthday-rr-photos'
const STORE_NAME = 'photos'
const THEMES = {
  starlit: { label: '星际生日基地', note: '火箭、行星、未来机器人', accent: '#ff7b6b', accentSoft: '#ffd9c4', colors: ['#15365d', '#5e8fd6', '#f6c75b'], icon: '✦' },
  meadow: { label: '彩虹糖果云', note: '云朵、彩虹、糖果星球', accent: '#ee795e', accentSoft: '#ffe0c6', colors: ['#38635c', '#f4ad77', '#fff0b5'], icon: '◌' },
  daylight: { label: '未来城市庆典', note: '全息灯牌、霓虹气球、数字烟花', accent: '#df5b5b', accentSoft: '#ffd2c6', colors: ['#547da8', '#e35e60', '#f6ce61'], icon: '⌁' },
  ocean: { label: '海底探险号', note: '潜水艇、水母、泡泡城堡', accent: '#e97763', accentSoft: '#ffd8c7', colors: ['#1f6578', '#4ab4b0', '#f3d26b'], icon: '≈' },
  forest: { label: '森林精灵站', note: '萤火虫、蘑菇、精灵屋', accent: '#e88658', accentSoft: '#ffe0c7', colors: ['#486d58', '#c7d987', '#f1b46b'], icon: '✿' },
  dinosaur: { label: '恐龙时光机', note: '化石、丛林、时间传送门', accent: '#e66b5c', accentSoft: '#ffd5c4', colors: ['#4d6d60', '#a7b86c', '#f1c56c'], icon: '◈' },
}
const INITIAL_MEMORIES = [
  { id: 'memory-1', age: '0 岁', title: '第一次看见这个世界', caption: '小小的你，让家里多了一束光。', tone: 'peach', imageId: null },
  { id: 'memory-2', age: '2 岁', title: '学会奔跑以后', caption: '每一步都认真，每一次笑都闪亮。', tone: 'mint', imageId: null },
  { id: 'memory-3', age: '4 岁', title: '好奇心的宇宙', caption: '你把平凡的日子，变成了冒险故事。', tone: 'sky', imageId: null },
]
const DEFAULT_PROJECT = { projectName: '小星星的生日影片', childName: '小星星', age: 6, birthday: '2026-10-12', theme: 'starlit', memories: INITIAL_MEMORIES }
const DURATIONS = { intro: 5, memory: 5, cake: 8, ending: 6 }
const TRANSITIONS = {
  kenburns: { label: '推近漂移', note: '轻微推近，适合成长照片' },
  spin3d: { label: '3D 旋转', note: '照片翻转进入画面' },
  stack3d: { label: '3D 堆叠', note: '多张照片错位叠入' },
  flip: { label: '卡片翻面', note: '像立体相册一样翻页' },
  film: { label: '胶片快切', note: '更短、更有节奏' },
}
const DEFAULT_MEMORY = { transition: 'spin3d', clipDuration: 2.6, mediaIds: [], mediaTypes: [] }

function loadProject() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return { ...DEFAULT_PROJECT, memories: normalizeMemories(INITIAL_MEMORIES) }
    const parsed = JSON.parse(saved)
    const memories = Array.isArray(parsed.memories) && parsed.memories.length ? parsed.memories : INITIAL_MEMORIES
    return { ...DEFAULT_PROJECT, ...parsed, memories: normalizeMemories(memories) }
  } catch { return { ...DEFAULT_PROJECT, memories: normalizeMemories(INITIAL_MEMORIES) } }
}
function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('IndexedDB unavailable')); return }
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function savePhoto(id, file) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(file, id)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}
async function removePhoto(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).delete(id)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}
async function getPhoto(id) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly')
    const request = tx.objectStore(STORE_NAME).get(id)
    request.onsuccess = () => { db.close(); resolve(request.result || null) }
    request.onerror = () => { db.close(); reject(request.error) }
  })
}
async function loadPhotoMap(ids) {
  const result = {}
  for (const id of ids) {
    const file = await getPhoto(id).catch(() => null)
    if (file) result[id] = file
  }
  return result
}
function makeId(prefix) { return (prefix || 'memory') + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) }
function memoryAssetId(memory) { return memory?.mediaId || memory?.imageId || memory?.mediaIds?.[0] || null }
function memoryAssetType(memory) { return memory?.mediaType || (memory?.mediaType?.[0]) || (memory?.imageId ? 'image' : null) }
function memoryAssetIds(memory) {
  if (Array.isArray(memory?.mediaIds)) return memory.mediaIds.filter(Boolean)
  const id = memoryAssetId(memory)
  return id ? [id] : []
}
function memoryAssetTypes(memory) {
  const ids = memoryAssetIds(memory)
  if (Array.isArray(memory?.mediaTypes)) return ids.map((_, index) => memory.mediaTypes[index] || 'image')
  const type = memoryAssetType(memory)
  return ids.map(() => type || 'image')
}
function normalizeMemory(memory) {
  const ids = memoryAssetIds(memory)
  const types = memoryAssetTypes(memory)
  return { ...DEFAULT_MEMORY, ...memory, mediaIds: ids, mediaTypes: types, mediaId: ids[0] || null, imageId: ids[0] || null, mediaType: types[0] || null, transition: TRANSITIONS[memory?.transition] ? memory.transition : DEFAULT_MEMORY.transition, clipDuration: Math.max(1.6, Math.min(6, Number(memory?.clipDuration) || DEFAULT_MEMORY.clipDuration)) }
}
function normalizeMemories(memories) { return (Array.isArray(memories) ? memories : []).map(normalizeMemory) }
function formatBirthday(value) { if (!value) return '今天'; const date = new Date(value + 'T00:00:00'); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(date) }
function sceneList(memories) { return [{ id: 'intro', label: '开场', short: '01' }, ...memories.map((m, i) => ({ id: m.id, label: '回忆 ' + (i + 1), short: String(i + 2).padStart(2, '0') })), { id: 'cake', label: '吹蜡烛', short: String(memories.length + 2).padStart(2, '0') }, { id: 'ending', label: '祝福', short: String(memories.length + 3).padStart(2, '0') }] }
function useObjectUrls(files) {
  const [urls, setUrls] = useState({})
  useEffect(() => { const next = Object.fromEntries(Object.entries(files).map((entry) => [entry[0], URL.createObjectURL(entry[1])])); setUrls(next); return () => Object.values(next).forEach((url) => URL.revokeObjectURL(url)) }, [files])
  return urls
}
function downloadBlob(blob, name) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000) }

export default function App() {
  const [page, setPage] = useState('home')
  const [project, setProject] = useState(loadProject)
  const [photoFiles, setPhotoFiles] = useState({})
  const photoUrls = useObjectUrls(photoFiles)
  const [currentScene, setCurrentScene] = useState('intro')
  const [isPlaying, setIsPlaying] = useState(false)
  const [sceneElapsed, setSceneElapsed] = useState(0)
  const [candlesOut, setCandlesOut] = useState(false)
  const [celebrating, setCelebrating] = useState(false)
  const [muted, setMuted] = useState(false)
  const [status, setStatus] = useState('本机模式 · 未连接云端')
  const [showEditor, setShowEditor] = useState(true)
  const audioRef = useRef(null)
  const celebrationRef = useRef(null)
  const scenes = useMemo(() => sceneList(project.memories), [project.memories])
  const sceneIndex = Math.max(0, scenes.findIndex((scene) => scene.id === currentScene))
  const theme = THEMES[project.theme] || THEMES.starlit
  const currentMemory = project.memories.find((memory) => memory.id === currentScene)
  const currentMemoryIds = memoryAssetIds(currentMemory)
  const currentClipDuration = Number(currentMemory?.clipDuration) || DEFAULT_MEMORY.clipDuration
  const duration = currentScene.startsWith('memory-') ? Math.max(1.6, currentMemoryIds.length * currentClipDuration) : (DURATIONS[currentScene] || 5)
  const activeMediaIndex = currentScene.startsWith('memory-') && currentMemoryIds.length ? Math.min(currentMemoryIds.length - 1, Math.floor(sceneElapsed / currentClipDuration)) : 0
  const progress = Math.min(100, sceneElapsed / duration * 100)

  useEffect(() => { loadPhotoMap([...new Set(project.memories.flatMap(memoryAssetIds))]).then(setPhotoFiles) }, [])
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)) }, [project])
  useEffect(() => { if (!isPlaying) return undefined; const timer = window.setInterval(() => { setSceneElapsed((elapsed) => { if (elapsed + .1 < duration) return Number((elapsed + .1).toFixed(1)); setCurrentScene(scenes[(sceneIndex + 1) % scenes.length].id); return 0 }) }, 100); return () => window.clearInterval(timer) }, [duration, isPlaying, sceneIndex, scenes])
  useEffect(() => () => window.clearTimeout(celebrationRef.current), [])

  function patchProject(patch) { setProject((current) => ({ ...current, ...patch })) }
  function patchMemory(id, patch) { setProject((current) => ({ ...current, memories: current.memories.map((memory) => memory.id === id ? { ...memory, ...patch } : memory) })) }
  function speakText(text) { if (!text || !('speechSynthesis' in window)) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'zh-CN'; utterance.rate = 0.95; utterance.pitch = 1.08; window.speechSynthesis.speak(utterance) }
  function playTone(frequency, length) { if (muted) return; const AudioCtor = window.AudioContext || window.webkitAudioContext; if (!AudioCtor) return; try { const context = audioRef.current || new AudioCtor(); audioRef.current = context; if (context.state === 'suspended') context.resume(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.type = 'sine'; oscillator.frequency.value = frequency || 520; gain.gain.setValueAtTime(.001, context.currentTime); gain.gain.exponentialRampToValueAtTime(.11, context.currentTime + .02); gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + (length || .12)); oscillator.connect(gain); gain.connect(context.destination); oscillator.start(); oscillator.stop(context.currentTime + (length || .12) + .02) } catch { /* sound is optional */ } }
  function goToScene(id) { setCurrentScene(id); setSceneElapsed(0); setCandlesOut(false); setIsPlaying(false); playTone(420) }
  function togglePlay() { setIsPlaying((playing) => { if (!playing) playTone(660, .16); return !playing }) }
  function startNew() { setProject({ ...DEFAULT_PROJECT, memories: normalizeMemories(INITIAL_MEMORIES.map((memory) => ({ ...memory }))) }); setPhotoFiles({}); setCurrentScene('intro'); setSceneElapsed(0); setPage('themes') }
  function resetProject() { startNew(); setPage('home'); setStatus('已恢复示例内容') }
  function moveMemory(id, direction) { setProject((current) => { const index = current.memories.findIndex((memory) => memory.id === id); const nextIndex = index + direction; if (index < 0 || nextIndex < 0 || nextIndex >= current.memories.length) return current; const memories = [...current.memories]; [memories[index], memories[nextIndex]] = [memories[nextIndex], memories[index]]; return { ...current, memories } }) }
  function addMemory() { const memory = normalizeMemory({ id: makeId('memory'), age: Math.max(0, project.age - 1) + ' 岁', title: '又长大了一点点', caption: '你的每一个新发现，都值得被好好记住。', tone: ['peach', 'mint', 'sky'][project.memories.length % 3] }); setProject((current) => ({ ...current, memories: [...current.memories, memory] })); setCurrentScene(memory.id); setSceneElapsed(0) }
  async function deleteMemory(memory) {
    if (project.memories.length <= 1) return
    const ids = memoryAssetIds(memory)
    await Promise.all(ids.map((id) => removePhoto(id).catch(() => {})))
    setPhotoFiles((current) => { const next = { ...current }; ids.forEach((id) => delete next[id]); return next })
    setProject((current) => ({ ...current, memories: current.memories.filter((item) => item.id !== memory.id) }))
    if (currentScene === memory.id) goToScene('intro')
  }
  async function handleUpload(event, targetMemoryId) {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/') || file.type.startsWith('video/'))
    if (!files.length) return
    const target = project.memories.find((memory) => memory.id === targetMemoryId) || project.memories.find((memory) => memoryAssetIds(memory).length === 0) || project.memories[0]
    if (!target) return
    const ids = []
    const types = []
    const fileMap = {}
    for (const file of files) {
      const id = makeId(file.type.startsWith('video/') ? 'video' : 'photo')
      await savePhoto(id, file).catch(() => {})
      ids.push(id)
      types.push(file.type.startsWith('video/') ? 'video' : 'image')
      fileMap[id] = file
    }
    setPhotoFiles((current) => ({ ...current, ...fileMap }))
    setProject((current) => ({ ...current, memories: current.memories.map((memory) => memory.id === target.id ? normalizeMemory({ ...memory, mediaIds: [...memoryAssetIds(memory), ...ids], mediaTypes: [...memoryAssetTypes(memory), ...types] }) : memory) }))
    setCurrentScene(target.id)
    setStatus(files.length + ' 个素材已加入「' + target.title + '」')
    event.target.value = ''
  }
  async function removeMemoryAsset(memory, assetId) {
    const ids = memoryAssetIds(memory).filter((id) => id !== assetId)
    const types = memoryAssetTypes(memory).filter((_, index) => memoryAssetIds(memory)[index] !== assetId)
    await removePhoto(assetId).catch(() => {})
    setPhotoFiles((current) => { const next = { ...current }; delete next[assetId]; return next })
    patchMemory(memory.id, normalizeMemory({ ...memory, mediaIds: ids, mediaTypes: types }))
    setStatus('已移除一张本地素材')
  }
  async function clearPhoto(memory) {
    const ids = memoryAssetIds(memory)
    await Promise.all(ids.map((id) => removePhoto(id).catch(() => {})))
    setPhotoFiles((current) => { const next = { ...current }; ids.forEach((id) => delete next[id]); return next })
    patchMemory(memory.id, normalizeMemory({ ...memory, mediaIds: [], mediaTypes: [] }))
    setStatus('该回忆的素材已从本机项目移除')
  }
  function blowCandles() { setCandlesOut(true); setIsPlaying(false); setCelebrating(true); playTone(880, .26); window.clearTimeout(celebrationRef.current); celebrationRef.current = window.setTimeout(() => setCelebrating(false), 6500) }
  async function exportProject() {
    setStatus('正在整理本机项目文件…')
    const mediaMeta = {}
    const archive = { 'project.json': strToU8(JSON.stringify({ ...project, mediaMeta }, null, 2)), 'README.txt': strToU8('Birthday Story Studio 本地项目文件\n照片、视频和内容仅用于本机导入。') }
    for (const memory of project.memories) {
      for (const assetId of memoryAssetIds(memory)) {
        const file = photoFiles[assetId] || await getPhoto(assetId).catch(() => null)
        if (!file) continue
        mediaMeta[assetId] = file.type || (memoryAssetTypes(memory).includes('video') ? 'video/mp4' : 'image/jpeg')
        archive['media/' + assetId] = new Uint8Array(await file.arrayBuffer())
      }
    }
    archive['project.json'] = strToU8(JSON.stringify({ ...project, mediaMeta }, null, 2))
    downloadBlob(new Blob([zipSync(archive)], { type: 'application/zip' }), (project.childName || 'birthday') + '-birthday.birthday')
    setStatus('项目备份已下载到本机')
  }
  async function importProject(event) { const file = event.target.files?.[0]; if (!file) return; try { const entries = unzipSync(new Uint8Array(await file.arrayBuffer())); const data = JSON.parse(strFromU8(entries['project.json'])); const importedFiles = {}; const mediaEntries = Object.keys(entries).filter((key) => key.startsWith('media/') || key.startsWith('photos/')); for (const name of mediaEntries) { const id = name.replace(/^media\//, '').replace(/^photos\//, ''); const type = data.mediaMeta?.[id] || data.photoMeta?.[id] || (id.startsWith('video-') ? 'video/mp4' : 'image/jpeg'); const blob = new Blob([entries[name]], { type }); await savePhoto(id, blob); importedFiles[id] = blob } const importedMemories = Array.isArray(data.memories) && data.memories.length ? normalizeMemories(data.memories) : normalizeMemories(DEFAULT_PROJECT.memories); const nextProject = { ...DEFAULT_PROJECT, ...data, memories: importedMemories }; delete nextProject.photoMeta; delete nextProject.mediaMeta; setProject(nextProject); setPhotoFiles(importedFiles); setCurrentScene('intro'); setPage('editor'); setStatus('项目已从本机导入') } catch { setStatus('导入失败，请选择 birthday 项目文件') } event.target.value = '' }

  function speakCurrentScene() { if (currentMemory) speakText(currentMemory.title + '。' + currentMemory.caption); else if (currentScene === 'cake') speakText('轮到你许愿了。轻轻吹灭蜡烛。'); else speakText(project.childName + '，' + project.age + '岁生日快乐。') }
  const shared = { project, theme, scenes, sceneIndex, currentScene, currentMemory, photoUrls, sceneElapsed, duration, progress, activeMediaIndex, candlesOut, celebrating, isPlaying, goToScene, togglePlay, blowCandles, setIsPlaying, setSceneElapsed, setCandlesOut, speakCurrentScene }
  return <main className={'app app-' + page + ' theme-' + project.theme} style={{ '--theme-accent': theme.accent, '--theme-accent-soft': theme.accentSoft }}>
    <Topbar page={page} project={project} status={status} onPage={setPage} onNew={startNew} onReset={resetProject} showEditor={showEditor} setShowEditor={setShowEditor} />
    {page === 'home' && <HomePage project={project} theme={theme} onNew={startNew} onContinue={() => setPage('editor')} onTheme={() => setPage('themes')} onExport={() => setPage('export')} />}
    {page === 'themes' && <ThemePage project={project} onBack={() => setPage('home')} onSelect={(themeId) => patchProject({ theme: themeId })} onNext={() => setPage('editor')} />}
    {page === 'editor' && <EditorPage {...shared} project={project} patchProject={patchProject} patchMemory={patchMemory} handleUpload={handleUpload} clearPhoto={clearPhoto} removeMemoryAsset={removeMemoryAsset} moveMemory={moveMemory} deleteMemory={deleteMemory} addMemory={addMemory} onOpenTheater={() => setPage('theater')} onOpenExport={() => setPage('export')} onBack={() => setPage('home')} />}
    {page === 'theater' && <TheaterPage {...shared} onBack={() => setPage('editor')} onOpenExport={() => setPage('export')} />}
    {page === 'export' && <ExportPage project={project} onBack={() => setPage('editor')} onExport={exportProject} onImport={importProject} status={status} />}
  </main>
}

function Topbar({ page, project, status, onPage, onNew, onReset, showEditor, setShowEditor }) {
  return <header className="topbar"><button className="brand-lockup" type="button" onClick={() => onPage('home')}><span className="brand-mark"><Rocket size={18} /></span><span><small>FUTURE BIRTHDAY LAB</small><strong>小小成长电影</strong></span></button><nav className="main-nav"><button className={page === 'home' ? 'active' : ''} type="button" onClick={() => onPage('home')}>控制台</button><button className={page === 'themes' ? 'active' : ''} type="button" onClick={() => onPage('themes')}>主题星球</button><button className={page === 'editor' ? 'active' : ''} type="button" onClick={() => onPage('editor')}>故事编辑</button><button className={page === 'theater' ? 'active' : ''} type="button" onClick={() => onPage('theater')}>剧场播放</button><button className={page === 'export' ? 'active' : ''} type="button" onClick={() => onPage('export')}>导出中心</button></nav><div className="topbar-actions"><span className="privacy-chip"><BadgeCheck size={14} />{status}</span><button className="button button-quiet desktop-only" type="button" onClick={onNew}><Plus size={15} />新影片</button><button className="icon-button mobile-only" type="button" onClick={() => setShowEditor((value) => !value)} aria-label={showEditor ? '收起编辑器' : '打开编辑器'}>{showEditor ? <X size={17} /> : <Settings2 size={17} />}</button><button className="icon-button" type="button" onClick={onReset} aria-label="恢复示例" title="恢复示例"><RotateCcw size={16} /></button></div></header>
}
function HomePage({ project, theme, onNew, onContinue, onTheme, onExport }) {
  return <div className="home-page page-wrap"><section className="home-hero"><div className="hero-copy"><span className="future-label"><Sparkles size={13} /> LOCAL-FIRST KIDS STUDIO</span><h1>把成长，<br /><strong>制作成一部会发光的电影。</strong></h1><p>照片留在你的设备里，故事由你亲手编排。选择一个小小宇宙，开始制作生日影片。</p><div className="hero-actions"><button className="button button-primary button-large" type="button" onClick={onNew}><Rocket size={17} />新建生日影片</button><button className="button button-outline button-large" type="button" onClick={onContinue}><Play size={16} fill="currentColor" />继续编辑</button></div><div className="hero-proof"><span><BadgeCheck size={14} />本机保存</span><span><Layers3 size={14} />可导出备份</span><span><Sparkles size={14} />儿童友好主题</span></div></div><div className="hero-orbit" aria-hidden="true"><div className="planet planet-main"><span>{theme.icon}</span></div><div className="planet planet-small planet-one">✦</div><div className="planet planet-small planet-two">◌</div><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><span className="orbit-star orbit-star-one"><Star size={15} fill="currentColor" /></span><span className="orbit-star orbit-star-two"><Star size={10} fill="currentColor" /></span><span className="orbit-label">{theme.label}<small>WORLD / 0{Object.keys(THEMES).findIndex((key) => key === project.theme) + 1}</small></span></div></section><section className="quick-start"><div className="section-title-row"><div><span className="section-kicker">YOUR LITTLE UNIVERSE</span><h2>从一个主题开始</h2></div><button className="text-link" type="button" onClick={onTheme}>查看全部主题<ArrowRight size={15} /></button></div><div className="theme-mini-grid">{Object.entries(THEMES).slice(0, 3).map(([key, item], index) => <button className={'theme-mini-card mini-' + index} key={key} type="button" onClick={onTheme}><span className="mini-scene"><span className="mini-planet">{item.icon}</span><span className="mini-star star-a">✦</span><span className="mini-star star-b">✦</span></span><span><strong>{item.label}</strong><small>{item.note}</small></span><ArrowRight size={15} /></button>)}</div></section><section className="project-strip"><div className="project-strip-icon"><Clapperboard size={20} /></div><div><span className="section-kicker">CURRENT PROJECT</span><h3>{project.projectName}</h3><p>{project.childName} · {project.age} 岁 · {project.memories.length} 个回忆场景</p></div><div className="project-strip-actions"><button className="button button-outline" type="button" onClick={onExport}><Download size={15} />导出备份</button><button className="button button-primary" type="button" onClick={onContinue}>继续制作<ArrowRight size={15} /></button></div></section></div>
}
function ThemePage({ project, onBack, onSelect, onNext }) {
  return <div className="page-wrap theme-page"><div className="subpage-heading"><button className="button button-quiet" type="button" onClick={onBack}><ArrowLeft size={15} />返回控制台</button><span className="step-count">01 / 04</span></div><div className="theme-heading"><span className="future-label"><Sparkles size={13} /> CHOOSE A WORLD</span><h1>先选一个属于你的<br /><strong>生日小宇宙</strong></h1><p>每个主题都会带来不同的开场、装饰和烟花颜色。</p></div><div className="theme-card-grid">{Object.entries(THEMES).map(([key, item], index) => <button type="button" key={key} className={'theme-big-card theme-big-' + index + (project.theme === key ? ' is-selected' : '')} onClick={() => onSelect(key)}><span className="theme-card-visual" style={{ '--c1': item.colors[0], '--c2': item.colors[1], '--c3': item.colors[2] }}><span className="theme-card-orbit orbit-a" /><span className="theme-card-orbit orbit-b" /><span className="theme-card-planet">{item.icon}</span><span className="theme-card-spark spark-a">✦</span><span className="theme-card-spark spark-b">✦</span><small>WORLD / 0{index + 1}</small></span><span className="theme-big-copy"><strong>{item.label}</strong><small>{item.note}</small></span>{project.theme === key && <span className="selected-badge"><BadgeCheck size={14} />当前选择</span>}</button>)}</div><div className="theme-page-footer"><span>主题之后仍然可以随时更换</span><button className="button button-primary button-large" type="button" onClick={onNext}>进入故事编辑<ArrowRight size={16} /></button></div></div>
}
function EditorPage({ project, theme, scenes, sceneIndex, currentScene, currentMemory, photoUrls, sceneElapsed, duration, progress, activeMediaIndex, candlesOut, celebrating, isPlaying, goToScene, togglePlay, blowCandles, patchProject, patchMemory, handleUpload, clearPhoto, removeMemoryAsset, moveMemory, deleteMemory, addMemory, speakCurrentScene, onOpenTheater, onOpenExport, onBack }) {
  return <div className="editor-page creator-editor"><aside className="editor-panel creator-sidebar"><div className="editor-heading creator-sidebar-head"><div><span className="section-kicker">AI BIRTHDAY CUT / 9:16</span><h2>{project.projectName}</h2><div className="creator-status"><span />素材只在本机处理</div></div><Clapperboard size={22} /></div><section className="editor-section creator-section"><div className="section-heading"><span>影片信息</span><span>01</span></div><label className="field-label"><span>影片名称</span><input value={project.projectName} maxLength={24} onChange={(event) => patchProject({ projectName: event.target.value })} /></label><div className="field-row"><label className="field-label"><span>主角名字</span><input value={project.childName} maxLength={12} onChange={(event) => patchProject({ childName: event.target.value })} /></label><label className="field-label"><span>生日年龄</span><div className="number-input"><input type="number" min="1" max="99" value={project.age} onChange={(event) => patchProject({ age: Math.max(1, Math.min(99, Number(event.target.value) || 1)) })} /><span>岁</span></div></label></div><label className="field-label"><span>生日日期</span><input type="date" value={project.birthday} onChange={(event) => patchProject({ birthday: event.target.value })} /></label></section><section className="editor-section creator-section"><div className="section-heading"><span>视觉世界</span><span>02</span></div><div className="theme-line-list">{Object.entries(THEMES).map(([key, item]) => <button key={key} type="button" className={'theme-line-choice ' + (project.theme === key ? 'is-selected' : '')} onClick={() => patchProject({ theme: key })}><span style={{ '--c1': item.colors[0], '--c2': item.colors[1] }}>{item.icon}</span><strong>{item.label}</strong><small>{item.note}</small>{project.theme === key && <BadgeCheck size={14} />}</button>)}</div></section><section className="editor-section creator-section"><div className="section-heading"><span>素材与字幕</span><span>03</span></div><label className="upload-dropzone creator-upload"><input type="file" accept="image/*,video/*" multiple onChange={(event) => handleUpload(event, currentScene)} /><span className="upload-icon"><ImagePlus size={18} /></span><span><strong>加入照片或视频</strong><small>支持一幕多张，全部只在本机处理</small></span><Upload size={15} /></label><div className="creator-layer-stack"><span><ImagePlus size={13} /> 多素材回忆</span><span><Sparkles size={13} /> 3D 转场模板</span><span><CakeSlice size={13} /> 真实感蛋糕与烟花</span></div><div className="memory-list">{project.memories.map((memory, index) => <MemoryEditorCard key={memory.id} memory={memory} index={index} total={project.memories.length} mediaItems={memoryAssetIds(memory).map((id, itemIndex) => ({ id, url: photoUrls[id], type: memoryAssetTypes(memory)[itemIndex] || 'image' }))} onPatch={patchMemory} onUpload={handleUpload} onRemoveMedia={removeMemoryAsset} onMove={moveMemory} onDelete={deleteMemory} onClearMedia={clearPhoto} />)}</div><button className="button button-outline add-memory-button" type="button" onClick={addMemory}><Plus size={15} />添加一幕</button></section><div className="editor-bottom-actions"><button className="button button-outline" type="button" onClick={onOpenExport}><Download size={15} />导出备份</button><button className="button button-primary" type="button" onClick={onOpenTheater}><Maximize2 size={15} />进入全屏剧场</button></div></aside><section className="editor-preview creator-workbench"><div className="preview-toolbar creator-toolbar"><div><button className="button button-quiet" type="button" onClick={onBack}><ArrowLeft size={15} />控制台</button><span className="preview-breadcrumb">/ 短视频创作</span></div><div className="preview-actions"><span className="creator-mode-chip"><span />9:16 SHORT VIDEO</span><button className="icon-button creator-icon-button" type="button" onClick={speakCurrentScene} aria-label="朗读当前字幕" title="朗读当前字幕"><Volume2 size={16} /></button><button className="button button-primary creator-play" type="button" onClick={togglePlay}>{isPlaying ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}{isPlaying ? '暂停' : '播放成片'}</button></div></div><div className="creator-preview-head"><div><span className="section-kicker">LIVE COMPOSER</span><strong>{currentMemory ? currentMemory.title : currentScene === 'cake' ? '3D 生日蛋糕舞台' : 'AI 生日短片预览'}</strong></div><span className="creator-timecode">{String(Math.floor(sceneElapsed / 60)).padStart(2, '0')}:{String(Math.floor(sceneElapsed % 60)).padStart(2, '0')} / 00:{String(Math.ceil(duration)).padStart(2, '0')}</span></div><PreviewStage project={project} theme={theme} currentScene={currentScene} currentMemory={currentMemory} photoUrls={photoUrls} activeMediaIndex={activeMediaIndex} candlesOut={candlesOut} celebrating={celebrating} onStart={togglePlay} onBlow={blowCandles} onReplay={() => goToScene('intro')} /><div className="creator-layer-dock"><button type="button" className="is-active"><Layers3 size={14} />画面</button><button type="button"><Sparkles size={14} />字幕</button><button type="button"><CakeSlice size={14} />3D舞台</button><button type="button" onClick={speakCurrentScene}><Volume2 size={14} />朗读</button></div><Timeline scenes={scenes} sceneIndex={sceneIndex} currentScene={currentScene} progress={progress} elapsed={sceneElapsed} duration={duration} onScene={goToScene} /></section></div>
}
function TheaterPage({ project, theme, scenes, sceneIndex, currentScene, currentMemory, photoUrls, sceneElapsed, duration, progress, activeMediaIndex, candlesOut, celebrating, isPlaying, goToScene, togglePlay, blowCandles, onBack, onOpenExport }) { return <div className="theater-page page-wrap"><div className="theater-top"><button className="button button-quiet" type="button" onClick={onBack}><ArrowLeft size={15} />返回编辑</button><span className="theater-title"><Sparkles size={14} />{project.childName} 的生日剧场</span><div><button className="button button-quiet" type="button" onClick={onOpenExport}><Download size={15} />导出</button><button className="icon-button" type="button" onClick={togglePlay} aria-label={isPlaying ? '暂停' : '播放'}>{isPlaying ? <Pause size={17} /> : <Play size={17} fill="currentColor" />}</button></div></div><div className="theater-stage"><PreviewStage project={project} theme={theme} currentScene={currentScene} currentMemory={currentMemory} photoUrls={photoUrls} activeMediaIndex={activeMediaIndex} candlesOut={candlesOut} celebrating={celebrating} onStart={togglePlay} onBlow={blowCandles} onReplay={() => goToScene('intro')} /></div><Timeline scenes={scenes} sceneIndex={sceneIndex} currentScene={currentScene} progress={progress} elapsed={sceneElapsed} duration={duration} onScene={goToScene} /></div> }
function ExportPage({ project, onBack, onExport, onImport, status }) { return <div className="page-wrap export-page"><div className="subpage-heading"><button className="button button-quiet" type="button" onClick={onBack}><ArrowLeft size={15} />返回编辑</button><span className="step-count">04 / 04</span></div><div className="export-heading"><span className="future-label"><Sparkles size={13} /> KEEP IT FOREVER</span><h1>把这段成长，<br /><strong>保存成一份礼物。</strong></h1><p>项目文件保存在你的设备上，可以备份、迁移和再次编辑。</p></div><div className="export-grid"><section className="export-card export-card-primary"><div className="export-card-icon"><FileDown size={22} /></div><div><span className="section-kicker">LOCAL PROJECT PACKAGE</span><h2>导出生日项目</h2><p>包含文字、主题、照片和时间线，可以换设备后重新导入。</p><button className="button button-primary" type="button" onClick={onExport}><Download size={15} />下载 .birthday 文件</button></div></section><section className="export-card"><div className="export-card-icon icon-blue"><FolderOpen size={22} /></div><div><span className="section-kicker">RESTORE A PROJECT</span><h2>导入生日项目</h2><p>从之前备份的项目文件继续编辑，照片不会上传到网络。</p><label className="button button-outline import-label"><Import size={15} />选择 .birthday 文件<input type="file" accept=".birthday,.zip,application/zip" onChange={onImport} /></label></div></section><section className="export-card export-card-muted"><div className="export-card-icon icon-lilac"><Clapperboard size={22} /></div><div><span className="section-kicker">NEXT MODULE</span><h2>导出生日视频</h2><p>下一阶段将加入本机 WebM 视频导出，再扩展 MP4 和 APK。</p><button className="button button-quiet" type="button" disabled><Sparkles size={15} />即将加入</button></div></section></div><div className="export-status"><BadgeCheck size={15} />{status}</div></div> }
function MemoryEditorCard({ memory, index, total, mediaItems, onPatch, onUpload, onRemoveMedia, onMove, onDelete, onClearMedia }) { const [open, setOpen] = useState(index === 0); return <article className={'memory-card creator-memory-card ' + (open ? 'is-open' : '')}><button className="memory-card-header" type="button" onClick={() => setOpen((value) => !value)}><span className={'memory-thumb tone-' + memory.tone}>{mediaItems[0]?.url && mediaItems[0]?.type === 'video' ? <video src={mediaItems[0].url} muted playsInline /> : mediaItems[0]?.url ? <img src={mediaItems[0].url} alt="" /> : <ImagePlus size={14} />} {mediaItems.length > 1 && <small className="media-count-badge">+{mediaItems.length - 1}</small>} {mediaItems[0]?.type === 'video' && <small className="media-type-badge">VIDEO</small>}</span><span className="memory-card-title"><strong>{memory.age}</strong><small>{memory.title}</small></span><ChevronDown size={15} /></button>{open && <div className="memory-card-body"><label className="field-label compact-label"><span>时间标签</span><input value={memory.age} onChange={(event) => onPatch(memory.id, { age: event.target.value })} /></label><label className="field-label compact-label"><span>这一幕的标题</span><input value={memory.title} onChange={(event) => onPatch(memory.id, { title: event.target.value })} /></label><label className="field-label compact-label"><span>动态字幕 / 旁白文字</span><textarea rows={2} value={memory.caption} onChange={(event) => onPatch(memory.id, { caption: event.target.value })} /></label><div className="memory-template-row"><label className="field-label compact-label"><span>转场模板</span><select className="memory-template-select" value={memory.transition || 'spin3d'} onChange={(event) => onPatch(memory.id, { transition: event.target.value })}>{Object.entries(TRANSITIONS).map(([key, item]) => <option key={key} value={key}>{item.label}</option>)}</select></label><label className="field-label compact-label"><span>每张停留秒数</span><input type="number" min="1.6" max="6" step="0.1" value={memory.clipDuration || 2.6} onChange={(event) => onPatch(memory.id, { clipDuration: Math.max(1.6, Math.min(6, Number(event.target.value) || 2.6)) })} /></label></div><div className="memory-assets-heading"><span>这一幕的素材 · {mediaItems.length} 个</span><label className="inline-upload-button"><ImagePlus size={13} />添加素材<input type="file" accept="image/*,video/*" multiple onChange={(event) => onUpload(event, memory.id)} /></label></div>{mediaItems.length ? <div className="memory-thumb-strip">{mediaItems.map((item, itemIndex) => <div className="memory-thumb-item" key={item.id}>{item.type === 'video' ? <video src={item.url} muted playsInline /> : <img src={item.url} alt="" />}<span>{String(itemIndex + 1).padStart(2, '0')}</span><button className="memory-thumb-remove" type="button" onClick={() => onRemoveMedia(memory, item.id)} aria-label={'移除第 ' + (itemIndex + 1) + ' 个素材'}><X size={11} /></button></div>)}</div> : <div className="memory-empty-state"><ImagePlus size={14} /><span>还没有素材，点击上方添加</span></div>}<div className="memory-card-footer"><button className="text-button" type="button" onClick={() => onClearMedia(memory)} disabled={!mediaItems.length}><Trash2 size={13} />清空这一幕</button><div className="memory-order-actions"><button className="icon-button small" type="button" onClick={() => onMove(memory.id, -1)} disabled={index === 0} aria-label="上移"><ArrowUp size={13} /></button><button className="icon-button small" type="button" onClick={() => onMove(memory.id, 1)} disabled={index === total - 1} aria-label="下移"><ArrowDown size={13} /></button><button className="icon-button small danger" type="button" onClick={() => onDelete(memory)} disabled={total <= 1} aria-label="删除"><Trash2 size={13} /></button></div></div></div>}</article> }
function PreviewStage({ project, theme, currentScene, currentMemory, photoUrls, activeMediaIndex, candlesOut, celebrating, onStart, onBlow, onReplay }) { const stageMode = currentScene === 'cake' ? 'cake' : currentScene === 'intro' ? 'intro' : currentScene.startsWith('memory-') ? 'memory' : 'ambient'; const mediaItems = currentMemory ? memoryAssetIds(currentMemory).map((id, index) => ({ id, url: photoUrls[id], type: memoryAssetTypes(currentMemory)[index] || 'image' })) : []; return <div className={'stage stage-' + (currentScene.startsWith('memory-') ? 'memory' : currentScene) + (celebrating ? ' is-celebrating' : '')}><SceneBackground theme={project.theme} /><ThreeCelebration mode={stageMode} theme={project.theme} age={project.age} candlesOut={candlesOut} celebrating={celebrating} /><div className="stage-noise" />{currentScene === 'intro' && <IntroScene project={project} theme={theme} onStart={onStart} />}{currentScene.startsWith('memory-') && currentMemory && <MemoryScene memory={currentMemory} mediaItems={mediaItems} activeMediaIndex={activeMediaIndex} project={project} />}{currentScene === 'cake' && <CakeScene project={project} candlesOut={candlesOut} onBlow={onBlow} />}{currentScene === 'ending' && <EndingScene project={project} mediaItems={project.memories.flatMap((memory) => memoryAssetIds(memory).map((id, index) => ({ url: photoUrls[id], type: memoryAssetTypes(memory)[index] || 'image' }))).filter((item) => item.url)} onReplay={onReplay} />}<div className="stage-footer"><span>FUTURE BIRTHDAY LAB</span><span>{project.childName} · {project.age} 岁</span></div></div> }
function Timeline({ scenes, sceneIndex, currentScene, progress, elapsed, duration, onScene }) { return <div className="timeline-area"><div className="timeline-header"><div><span className="timeline-title">故事时间线</span><span className="timeline-subtitle">点击任意场景预览</span></div><span className="timeline-duration">{Math.ceil(elapsed)}s / {duration}s</span></div><div className="timeline-track"><div className="timeline-progress" style={{ width: (((sceneIndex + progress / 100) / scenes.length) * 100) + '%' }} />{scenes.map((scene, index) => <button key={scene.id} type="button" className={'timeline-marker ' + (scene.id === currentScene ? 'is-active' : '')} style={{ left: ((index / Math.max(1, scenes.length - 1)) * 100) + '%' }} onClick={() => onScene(scene.id)}><span className="marker-dot" /><span className="marker-label"><small>{scene.short}</small>{scene.label}</span></button>)}</div></div> }
function SceneBackground({ theme }) { return <div className={'scene-background background-' + theme}><span className="glow glow-one" /><span className="glow glow-two" /><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="background-star star-one"><Star size={10} fill="currentColor" /></span><span className="background-star star-two"><Star size={8} fill="currentColor" /></span><span className="background-star star-three"><Star size={13} fill="currentColor" /></span><span className="hud-line line-one" /><span className="hud-line line-two" /></div> }
function IntroScene({ project, theme, onStart }) { return <div className="scene-content intro-content"><div className="intro-ribbon"><Sparkles size={13} /> {theme.label.toUpperCase()}</div><p className="scene-overline">{formatBirthday(project.birthday)} · FAMILY ARCHIVE</p><h2>{project.childName || '小星星'}<span>的</span><strong>{project.age}<small>岁</small></strong><em>生日</em></h2><p className="scene-description">一艘小小火箭已经准备出发，<br />带你穿过每一段闪闪发光的成长。</p><button className="stage-start-button" type="button" onClick={onStart}><span><Play size={16} fill="currentColor" /></span>开始放映</button><div className="intro-stamp"><span>MISSION</span><strong>0{project.age}</strong><small>LOVE / LAUGHTER / LIGHT</small></div></div> }
function MemoryScene({ memory, mediaItems, activeMediaIndex, project }) { const hasMedia = mediaItems.length > 0; return <div className="scene-content memory-content"><div className={'memory-visual tone-' + memory.tone + ' transition-' + (memory.transition || 'spin3d')}><div className="memory-media-stack">{hasMedia ? mediaItems.map((item, index) => <div className={'memory-frame ' + (index === activeMediaIndex ? 'is-active ' : '') + (item.type === 'video' ? 'video' : '')} key={item.id}>{item.type === 'video' ? <video src={item.url} autoPlay muted loop playsInline /> : <img src={item.url} alt={project.childName + ' ' + memory.age + ' 的素材'} />}</div>) : <PlaceholderPhoto tone={memory.tone} />} </div><span className="image-corner top-left" /><span className="image-corner bottom-right" /><span className="photo-index">MEMORY / {memory.age} · {hasMedia ? String(activeMediaIndex + 1).padStart(2, '0') + ' / ' + String(mediaItems.length).padStart(2, '0') : 'WAITING'}</span>{mediaItems[activeMediaIndex]?.type === 'video' && <span className="media-label"><Play size={10} fill="currentColor" /> LIVE CLIP</span>}</div><div className="memory-copy caption-rise"><p className="scene-overline">{memory.age} · A MOMENT TO KEEP</p><h2>{memory.title}</h2><p>{memory.caption}</p><span className="memory-line" /></div></div> }
function PlaceholderPhoto({ tone }) { return <div className={'placeholder-photo placeholder-' + tone}><span className="placeholder-sun" /><span className="placeholder-hill hill-one" /><span className="placeholder-hill hill-two" /><span className="placeholder-spark spark-one" /><span className="placeholder-spark spark-two" /><span className="placeholder-note">YOUR PHOTO<br /><small>GOES HERE</small></span></div> }
function CakeScene({ project, candlesOut, onBlow }) { return <div className="scene-content cake-content"><div className="cake-intro"><p className="scene-overline">MAKE A WISH · {project.age} CANDLES</p><h2>轮到你许愿了</h2><p>{candlesOut ? '愿望已经被星星听见。' : '轻轻点一下，把蜡烛吹灭。'}</p></div><div className="cake-3d-label"><CakeSlice size={16} /> REAL-TIME 3D STAGE</div><button className={'wish-button ' + (candlesOut ? 'is-done' : '')} type="button" onClick={onBlow} disabled={candlesOut}>{candlesOut ? <><Sparkles size={16} />愿望已送达</> : <><WandSparkles size={16} />吹灭蜡烛</>}</button></div> }
function EndingScene({ project, mediaItems, onReplay }) { return <div className="scene-content ending-content"><div className="ending-kicker"><CakeSlice size={17} /> THE NEXT CHAPTER STARTS NOW</div><h2>愿你每一岁，<br /><strong>都比上一岁更快乐。</strong></h2><div className="ending-collage">{[0, 1, 2].map((index) => <div className={'ending-photo ending-photo-' + index} key={index}>{mediaItems[index]?.type === 'video' ? <video src={mediaItems[index].url} muted autoPlay loop playsInline /> : mediaItems[index]?.url ? <img src={mediaItems[index].url} alt="成长回忆" /> : <PlaceholderPhoto tone={['peach', 'mint', 'sky'][index]} />}</div>)}</div><p className="ending-signature">Happy birthday, {project.childName || '小星星'}.</p><button className="stage-replay-button" type="button" onClick={onReplay}><RotateCcw size={15} />再看一遍</button></div> }
function Fireworks() { return <div className="fireworks" aria-hidden="true">{Array.from({ length: 34 }, (_, index) => <i key={index} style={{ '--i': index, '--angle': (index * 10.6) + 'deg' }} />)}</div> }
