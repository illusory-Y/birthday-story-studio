import { useEffect, useMemo, useRef, useState } from 'react'
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, CakeSlice, ChevronDown,
  Clapperboard, ImagePlus, Pause, Play, Plus, RotateCcw, Settings2,
  Sparkles, Star, Trash2, Upload, Volume2, VolumeX, WandSparkles, X,
} from 'lucide-react'

const STORAGE_KEY = 'birthday-rr-project-v1'
const PHOTO_DB_NAME = 'birthday-rr-photos'
const PHOTO_STORE_NAME = 'photos'
const THEMES = {
  starlit: { label: '星光夜空', note: '深蓝 × 珊瑚 × 香槟金', accent: '#f26d5b', accentSoft: '#ffd8c7' },
  meadow: { label: '晨间草地', note: '松针绿 × 蜜桃 × 奶油白', accent: '#e7835b', accentSoft: '#ffe2ce' },
  daylight: { label: '彩窗日光', note: '靛青 × 橙红 × 柠檬黄', accent: '#d9554d', accentSoft: '#ffd6bf' },
}
const INITIAL_MEMORIES = [
  { id: 'memory-1', age: '0 岁', title: '第一次看见这个世界', caption: '小小的你，让家里多了一束光。', tone: 'peach', imageId: null },
  { id: 'memory-2', age: '2 岁', title: '学会奔跑以后', caption: '每一步都认真，每一次笑都闪亮。', tone: 'mint', imageId: null },
  { id: 'memory-3', age: '4 岁', title: '好奇心的宇宙', caption: '你把平凡的日子，变成了冒险故事。', tone: 'sky', imageId: null },
]
const DEFAULT_PROJECT = { childName: '小星星', age: 6, birthday: '2026-10-12', theme: 'starlit', memories: INITIAL_MEMORIES }
const SCENE_DURATIONS = { intro: 5, memory: 5, cake: 8, ending: 6 }

function loadProject() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return DEFAULT_PROJECT
    const parsed = JSON.parse(saved)
    return { ...DEFAULT_PROJECT, ...parsed, memories: Array.isArray(parsed.memories) && parsed.memories.length ? parsed.memories : INITIAL_MEMORIES }
  } catch { return DEFAULT_PROJECT }
}
function openPhotoDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) { reject(new Error('IndexedDB unavailable')); return }
    const request = indexedDB.open(PHOTO_DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(PHOTO_STORE_NAME)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}
async function savePhoto(id, file) {
  const db = await openPhotoDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTO_STORE_NAME, 'readwrite')
    transaction.objectStore(PHOTO_STORE_NAME).put(file, id)
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
}
async function removePhoto(id) {
  const db = await openPhotoDb()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PHOTO_STORE_NAME, 'readwrite')
    transaction.objectStore(PHOTO_STORE_NAME).delete(id)
    transaction.oncomplete = () => { db.close(); resolve() }
    transaction.onerror = () => { db.close(); reject(transaction.error) }
  })
}
async function readPhotos(ids) {
  try {
    const db = await openPhotoDb()
    const entries = await Promise.all(ids.map((id) => new Promise((resolve) => {
      const transaction = db.transaction(PHOTO_STORE_NAME, 'readonly')
      const request = transaction.objectStore(PHOTO_STORE_NAME).get(id)
      request.onsuccess = () => resolve([id, request.result])
      request.onerror = () => resolve([id, null])
    })))
    db.close()
    return Object.fromEntries(entries.filter((entry) => entry[1]))
  } catch { return {} }
}
function createId(prefix) { return (prefix || 'memory') + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) }
function formatBirthday(value) {
  if (!value) return '今天'
  const date = new Date(value + 'T00:00:00')
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(date)
}
function getSceneList(memories) {
  return [
    { id: 'intro', label: '开场', short: '01' },
    ...memories.map((memory, index) => ({ id: memory.id, label: '回忆 ' + (index + 1), short: String(index + 2).padStart(2, '0') })),
    { id: 'cake', label: '吹蜡烛', short: String(memories.length + 2).padStart(2, '0') },
    { id: 'ending', label: '祝福', short: String(memories.length + 3).padStart(2, '0') },
  ]
}
function useObjectUrls(photoFiles) {
  const [urls, setUrls] = useState({})
  useEffect(() => {
    const nextUrls = Object.fromEntries(Object.entries(photoFiles).map((entry) => [entry[0], URL.createObjectURL(entry[1])]))
    setUrls(nextUrls)
    return () => Object.values(nextUrls).forEach((url) => URL.revokeObjectURL(url))
  }, [photoFiles])
  return urls
}

export default function App() {
  const [project, setProject] = useState(loadProject)
  const [photoFiles, setPhotoFiles] = useState({})
  const photoUrls = useObjectUrls(photoFiles)
  const [currentScene, setCurrentScene] = useState('intro')
  const [isPlaying, setIsPlaying] = useState(false)
  const [sceneElapsed, setSceneElapsed] = useState(0)
  const [candlesOut, setCandlesOut] = useState(false)
  const [isCelebrating, setIsCelebrating] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [showEditor, setShowEditor] = useState(true)
  const [saveLabel, setSaveLabel] = useState('本地保存中')
  const [statusMessage, setStatusMessage] = useState('照片只保存在当前浏览器')
  const audioContextRef = useRef(null)
  const celebrationTimerRef = useRef(null)
  const scenes = useMemo(() => getSceneList(project.memories), [project.memories])
  const sceneIndex = Math.max(0, scenes.findIndex((scene) => scene.id === currentScene))
  const theme = THEMES[project.theme] || THEMES.starlit
  const currentMemory = project.memories.find((memory) => memory.id === currentScene)
  const currentDuration = currentScene.startsWith('memory-') ? SCENE_DURATIONS.memory : (SCENE_DURATIONS[currentScene] || 5)
  const progress = Math.min(100, (sceneElapsed / currentDuration) * 100)

  useEffect(() => {
    readPhotos(project.memories.map((memory) => memory.imageId).filter(Boolean)).then(setPhotoFiles)
  }, [])
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project))
    setSaveLabel('已保存到本机')
    const timer = window.setTimeout(() => setSaveLabel('自动保存已开启'), 1400)
    return () => window.clearTimeout(timer)
  }, [project])
  useEffect(() => {
    if (!isPlaying) return undefined
    const timer = window.setInterval(() => {
      setSceneElapsed((elapsed) => {
        if (elapsed + 0.1 < currentDuration) return Number((elapsed + 0.1).toFixed(1))
        const nextIndex = (sceneIndex + 1) % scenes.length
        setCurrentScene(scenes[nextIndex].id)
        return 0
      })
    }, 100)
    return () => window.clearInterval(timer)
  }, [currentDuration, isPlaying, sceneIndex, scenes])
  useEffect(() => () => window.clearTimeout(celebrationTimerRef.current), [])

  function patchProject(patch) { setProject((current) => ({ ...current, ...patch })) }
  function patchMemory(id, patch) {
    setProject((current) => ({ ...current, memories: current.memories.map((memory) => memory.id === id ? { ...memory, ...patch } : memory) }))
  }
  function playTone(frequency, duration) {
    if (isMuted) return
    const AudioCtor = window.AudioContext || window.webkitAudioContext
    if (!AudioCtor) return
    try {
      const context = audioContextRef.current || new AudioCtor()
      audioContextRef.current = context
      if (context.state === 'suspended') context.resume()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency || 520
      gain.gain.setValueAtTime(0.001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.12, context.currentTime + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + (duration || 0.12))
      oscillator.connect(gain); gain.connect(context.destination)
      oscillator.start(); oscillator.stop(context.currentTime + (duration || 0.12) + 0.02)
    } catch { /* sound is optional */ }
  }
  function goToScene(id) { setCurrentScene(id); setSceneElapsed(0); setCandlesOut(false); setIsPlaying(false); playTone(420) }
  function togglePlayback() { setIsPlaying((playing) => { if (!playing) playTone(660, 0.16); return !playing }) }
  function moveMemory(id, direction) {
    setProject((current) => {
      const index = current.memories.findIndex((memory) => memory.id === id)
      const nextIndex = index + direction
      if (index < 0 || nextIndex < 0 || nextIndex >= current.memories.length) return current
      const memories = [...current.memories]
      ;[memories[index], memories[nextIndex]] = [memories[nextIndex], memories[index]]
      return { ...current, memories }
    })
  }
  function addMemory() {
    const newMemory = { id: createId(), age: Math.max(0, project.age - 1) + ' 岁', title: '又长大了一点点', caption: '你的每一个新发现，都值得被好好记住。', tone: ['peach', 'mint', 'sky'][project.memories.length % 3], imageId: null }
    setProject((current) => ({ ...current, memories: [...current.memories, newMemory] }))
    setCurrentScene(newMemory.id); setSceneElapsed(0)
  }
  async function deleteMemory(memory) {
    if (project.memories.length <= 1) return
    if (memory.imageId) {
      await removePhoto(memory.imageId).catch(() => {})
      setPhotoFiles((current) => { const next = { ...current }; delete next[memory.imageId]; return next })
    }
    setProject((current) => ({ ...current, memories: current.memories.filter((item) => item.id !== memory.id) }))
    if (currentScene === memory.id) goToScene('intro')
  }
  async function handleUpload(event) {
    const files = Array.from(event.target.files || []).filter((file) => file.type.startsWith('image/'))
    if (!files.length) return
    const available = project.memories.filter((memory) => !memory.imageId)
    const targets = available.length ? available : project.memories
    const updates = []
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const target = targets[index % targets.length]
      const imageId = target.imageId || createId('photo')
      await savePhoto(imageId, file).catch(() => {})
      updates.push([target.id, imageId, file])
    }
    setPhotoFiles((current) => ({ ...current, ...Object.fromEntries(updates.map((item) => [item[1], item[2]])) }))
    setProject((current) => ({ ...current, memories: current.memories.map((memory) => { const update = updates.find((item) => item[0] === memory.id); return update ? { ...memory, imageId: update[1] } : memory }) }))
    setStatusMessage(files.length + ' 张照片已加入回忆时间线')
    event.target.value = ''
  }
  async function clearPhoto(memory) {
    if (!memory.imageId) return
    await removePhoto(memory.imageId).catch(() => {})
    setPhotoFiles((current) => { const next = { ...current }; delete next[memory.imageId]; return next })
    patchMemory(memory.id, { imageId: null }); setStatusMessage('已移除这张照片，保留文字内容')
  }
  function resetProject() {
    setProject(DEFAULT_PROJECT); setPhotoFiles({}); setCurrentScene('intro'); setSceneElapsed(0); setIsPlaying(false); setCandlesOut(false); setStatusMessage('已恢复示例内容')
  }
  function blowCandles() {
    setCandlesOut(true); setIsPlaying(false); setIsCelebrating(true); playTone(880, 0.26)
    window.clearTimeout(celebrationTimerRef.current)
    celebrationTimerRef.current = window.setTimeout(() => setIsCelebrating(false), 4200)
  }
  function openNextScene() { goToScene(scenes[Math.min(scenes.length - 1, sceneIndex + 1)].id) }
  function openPreviousScene() { goToScene(scenes[Math.max(0, sceneIndex - 1)].id) }

  return <main className={'app theme-' + project.theme} style={{ '--theme-accent': theme.accent, '--theme-accent-soft': theme.accentSoft }}>
    <header className="topbar">
      <div className="brand-lockup"><div className="brand-mark"><Sparkles size={18} strokeWidth={2.4} /></div><div><p className="eyebrow">BIRTHDAY RR / STUDIO</p><h1>小小成长电影</h1></div></div>
      <div className="topbar-actions"><span className="save-status"><span className="save-dot" />{saveLabel}</span><button className="icon-button mobile-editor-toggle" type="button" onClick={() => setShowEditor((visible) => !visible)} aria-label={showEditor ? '收起编辑器' : '打开编辑器'}>{showEditor ? <X size={18} /> : <Settings2 size={18} />}</button><button className="button button-quiet" type="button" onClick={resetProject}><RotateCcw size={15} />恢复示例</button></div>
    </header>
    <div className="workspace">
      <aside className={'editor-panel ' + (showEditor ? 'is-open' : '')}>
        <div className="panel-intro"><div><p className="section-kicker">CREATE A MEMORY</p><h2>把成长剪成一部短片</h2></div><Clapperboard size={22} className="panel-intro-icon" /></div>
        <section className="editor-section"><div className="section-heading"><span>影片信息</span><span className="section-index">01</span></div><div className="field-stack"><label className="field-label"><span>主角名字</span><input value={project.childName} maxLength={12} onChange={(event) => patchProject({ childName: event.target.value })} /></label><div className="field-row"><label className="field-label"><span>今天几岁</span><div className="number-input"><input type="number" min="1" max="99" value={project.age} onChange={(event) => patchProject({ age: Math.max(1, Math.min(99, Number(event.target.value) || 1)) })} /><span>岁</span></div></label><label className="field-label"><span>生日日期</span><input type="date" value={project.birthday} onChange={(event) => patchProject({ birthday: event.target.value })} /></label></div></div></section>
        <section className="editor-section"><div className="section-heading"><span>影片主题</span><span className="section-index">02</span></div><div className="theme-grid">{Object.entries(THEMES).map(([key, item]) => <button key={key} type="button" className={'theme-choice theme-choice-' + key + (project.theme === key ? ' is-selected' : '')} onClick={() => patchProject({ theme: key })}><span className="theme-swatch" /><span className="theme-choice-copy"><strong>{item.label}</strong><small>{item.note}</small></span>{project.theme === key && <span className="choice-check">✓</span>}</button>)}</div></section>
        <section className="editor-section"><div className="section-heading"><span>成长回忆</span><span className="section-index">03</span></div><label className="upload-dropzone"><input type="file" accept="image/*" multiple onChange={handleUpload} /><span className="upload-icon"><ImagePlus size={19} /></span><span><strong>上传照片</strong><small>多选图片，按顺序放入时间线</small></span><Upload size={16} className="upload-arrow" /></label><div className="memory-list">{project.memories.map((memory, index) => <MemoryEditorCard key={memory.id} memory={memory} index={index} total={project.memories.length} imageUrl={memory.imageId ? photoUrls[memory.imageId] : undefined} onPatch={patchMemory} onMove={moveMemory} onDelete={deleteMemory} onClearPhoto={clearPhoto} />)}</div><button className="button button-outline add-memory-button" type="button" onClick={addMemory}><Plus size={16} />添加一幕回忆</button></section>
        <div className="privacy-note"><span className="privacy-lock">⌁</span><span>{statusMessage}</span></div>
      </aside>
      <section className="preview-panel">
        <div className="preview-toolbar"><div className="preview-meta"><span className="live-pill"><span />LIVE PREVIEW</span><span className="preview-date">{formatBirthday(project.birthday)} · {theme.label}</span></div><div className="preview-actions"><button className="icon-button" type="button" onClick={() => setIsMuted((muted) => !muted)} aria-label={isMuted ? '打开提示音' : '关闭提示音'} title={isMuted ? '打开提示音' : '关闭提示音'}>{isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button><button className="button button-primary" type="button" onClick={togglePlayback}>{isPlaying ? <Pause size={15} /> : <Play size={15} fill="currentColor" />}{isPlaying ? '暂停影片' : '播放影片'}</button></div></div>
        <div className="stage-wrap"><div className={'stage stage-' + (currentScene.startsWith('memory-') ? 'memory' : currentScene) + (isCelebrating ? ' is-celebrating' : '')}><SceneBackground theme={project.theme} /><div className="stage-noise" />{currentScene === 'intro' && <IntroScene project={project} onStart={togglePlayback} />}{currentScene.startsWith('memory-') && currentMemory && <MemoryScene memory={currentMemory} imageUrl={photoUrls[currentMemory.imageId]} project={project} />}{currentScene === 'cake' && <CakeScene project={project} candlesOut={candlesOut} onBlow={blowCandles} />}{currentScene === 'ending' && <EndingScene project={project} imageUrls={project.memories.map((memory) => photoUrls[memory.imageId]).filter(Boolean)} onReplay={() => goToScene('intro')} />}{isCelebrating && <Fireworks />}<div className="stage-footer"><span>{String(sceneIndex + 1).padStart(2, '0')} / {String(scenes.length).padStart(2, '0')}</span><span>{currentScene === 'cake' && candlesOut ? '愿望已送达' : '小小成长电影'}</span></div></div></div>
        <div className="timeline-area"><div className="timeline-header"><div><span className="timeline-title">播放时间线</span><span className="timeline-subtitle">点击任意一幕预览</span></div><span className="timeline-duration">约 {scenes.length * 5 + 4} 秒</span></div><div className="timeline-track"><div className="timeline-progress" style={{ width: (((sceneIndex + progress / 100) / scenes.length) * 100) + '%' }} />{scenes.map((scene, index) => <button key={scene.id} type="button" className={'timeline-marker' + (scene.id === currentScene ? ' is-active' : '')} style={{ left: ((index / Math.max(1, scenes.length - 1)) * 100) + '%' }} onClick={() => goToScene(scene.id)}><span className="marker-dot" /><span className="marker-label"><small>{scene.short}</small>{scene.label}</span></button>)}</div><div className="scene-navigation"><button className="button button-quiet" type="button" onClick={openPreviousScene} disabled={sceneIndex === 0}><ArrowLeft size={15} />上一幕</button><div className="scene-progress-copy"><span>{Math.ceil(sceneElapsed)}s</span><span>/ {currentDuration}s</span></div><button className="button button-quiet" type="button" onClick={openNextScene} disabled={sceneIndex === scenes.length - 1}>下一幕<ArrowRight size={15} /></button></div></div>
      </section>
    </div>
  </main>
}

function MemoryEditorCard({ memory, index, total, imageUrl, onPatch, onMove, onDelete, onClearPhoto }) {
  const [isOpen, setIsOpen] = useState(index === 0)
  return <article className={'memory-card' + (isOpen ? ' is-open' : '')}><button className="memory-card-header" type="button" onClick={() => setIsOpen((open) => !open)}><span className={'memory-thumb tone-' + memory.tone} style={imageUrl ? { backgroundImage: 'url(' + imageUrl + ')' } : undefined}>{!imageUrl && <ImagePlus size={15} />}</span><span className="memory-card-title"><strong>{memory.age || '未设置年龄'}</strong><small>{memory.title || '未命名回忆'}</small></span><ChevronDown size={16} className="memory-chevron" /></button>{isOpen && <div className="memory-card-body"><label className="field-label compact-label"><span>时间标签</span><input value={memory.age} maxLength={10} onChange={(event) => onPatch(memory.id, { age: event.target.value })} /></label><label className="field-label compact-label"><span>这一幕的标题</span><input value={memory.title} maxLength={24} onChange={(event) => onPatch(memory.id, { title: event.target.value })} /></label><label className="field-label compact-label"><span>一句话</span><textarea value={memory.caption} maxLength={48} rows={2} onChange={(event) => onPatch(memory.id, { caption: event.target.value })} /></label><div className="memory-card-footer">{imageUrl ? <button className="text-button" type="button" onClick={() => onClearPhoto(memory)}><Trash2 size={14} />移除照片</button> : <span className="no-photo-label">尚未放入照片</span>}<div className="memory-order-actions"><button className="icon-button small" type="button" onClick={() => onMove(memory.id, -1)} disabled={index === 0} aria-label="上移" title="上移"><ArrowUp size={14} /></button><button className="icon-button small" type="button" onClick={() => onMove(memory.id, 1)} disabled={index === total - 1} aria-label="下移" title="下移"><ArrowDown size={14} /></button><button className="icon-button small danger" type="button" onClick={() => onDelete(memory)} disabled={total <= 1} aria-label="删除这一幕" title="删除这一幕"><Trash2 size={14} /></button></div></div></div>}</article>
}

function SceneBackground({ theme }) {
  return <div className={'scene-background background-' + theme} aria-hidden="true"><span className="glow glow-one" /><span className="glow glow-two" /><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="background-star star-one"><Star size={10} fill="currentColor" /></span><span className="background-star star-two"><Star size={8} fill="currentColor" /></span><span className="background-star star-three"><Star size={13} fill="currentColor" /></span></div>
}
function IntroScene({ project, onStart }) {
  return <div className="scene-content intro-content"><div className="intro-ribbon"><Sparkles size={13} /> A LITTLE FILM ABOUT YOU</div><p className="scene-overline">{formatBirthday(project.birthday)} · FAMILY ARCHIVE</p><h2>{project.childName || '小星星'}<span>的</span><strong>{project.age}<small>岁</small></strong><em>生日</em></h2><p className="scene-description">把被爱记录下来，<br />就会变成一部会发光的成长电影。</p><button className="stage-start-button" type="button" onClick={onStart}><span><Play size={16} fill="currentColor" /></span>开始放映</button><div className="intro-stamp"><span>EST.</span><strong>2020</strong><small>LOVE / LAUGHTER / LIGHT</small></div></div>
}
function MemoryScene({ memory, imageUrl, project }) {
  return <div className="scene-content memory-content"><div className={'memory-visual tone-' + memory.tone}>{imageUrl ? <img src={imageUrl} alt={project.childName + ' ' + memory.age + ' 的照片'} /> : <PlaceholderPhoto tone={memory.tone} />}<span className="image-corner top-left" /><span className="image-corner bottom-right" /><span className="photo-index">MEMORY / {memory.age}</span></div><div className="memory-copy"><p className="scene-overline">{memory.age} · A MOMENT TO KEEP</p><h2>{memory.title}</h2><p>{memory.caption}</p><span className="memory-line" /></div></div>
}
function PlaceholderPhoto({ tone }) {
  return <div className={'placeholder-photo placeholder-' + tone}><span className="placeholder-sun" /><span className="placeholder-hill hill-one" /><span className="placeholder-hill hill-two" /><span className="placeholder-spark spark-one" /><span className="placeholder-spark spark-two" /><span className="placeholder-note">YOUR PHOTO<br /><small>GOES HERE</small></span></div>
}
function CakeScene({ project, candlesOut, onBlow }) {
  const candleCount = Math.min(7, Math.max(1, Number(project.age) || 1))
  return <div className="scene-content cake-content"><div className="cake-intro"><p className="scene-overline">MAKE A WISH · {project.age} CANDLES</p><h2>轮到你许愿了</h2><p>{candlesOut ? '愿望已经被星星听见。' : '轻轻点一下，把蜡烛吹灭。'}</p></div><div className={'cake-illustration' + (candlesOut ? ' candles-out' : '')}><div className="cake-candles">{Array.from({ length: candleCount }, (_, index) => <span className="candle" key={index}><i /></span>)}</div><div className="cake-top"><span className="cake-cream cream-one" /><span className="cake-cream cream-two" /><span className="cake-berry berry-one" /><span className="cake-berry berry-two" /></div><div className="cake-body"><span className="cake-stripe" /><span className="cake-stripe" /><span className="cake-stripe" /></div><div className="cake-plate" /></div><button className={'wish-button' + (candlesOut ? ' is-done' : '')} type="button" onClick={onBlow} disabled={candlesOut}>{candlesOut ? <><Sparkles size={16} />愿望已送达</> : <><WandSparkles size={16} />吹灭蜡烛</>}</button></div>
}
function EndingScene({ project, imageUrls, onReplay }) {
  return <div className="scene-content ending-content"><div className="ending-kicker"><CakeSlice size={17} /> THE NEXT CHAPTER STARTS NOW</div><h2>愿你每一岁，<br /><strong>都比上一岁更快乐。</strong></h2><div className="ending-collage">{[0, 1, 2].map((index) => <div className={'ending-photo ending-photo-' + index} key={index}>{imageUrls[index] ? <img src={imageUrls[index]} alt="成长回忆" /> : <PlaceholderPhoto tone={['peach', 'mint', 'sky'][index]} />}</div>)}</div><p className="ending-signature">Happy birthday, {project.childName || '小星星'}.</p><button className="stage-replay-button" type="button" onClick={onReplay}><RotateCcw size={15} />再看一遍</button></div>
}
function Fireworks() { return <div className="fireworks" aria-hidden="true">{Array.from({ length: 34 }, (_, index) => <i key={index} style={{ '--i': index, '--angle': (index * 10.6) + 'deg' }} />)}</div> }
