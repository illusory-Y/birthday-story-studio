import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const PALETTES = {
  starlit: { primary: 0xff806f, secondary: 0x67d9e3, gold: 0xffd36d, deep: 0x091326 },
  meadow: { primary: 0xff9b78, secondary: 0x8de0b4, gold: 0xffe29b, deep: 0x102320 },
  daylight: { primary: 0xff786b, secondary: 0x80d5ee, gold: 0xffdb74, deep: 0x12213b },
  ocean: { primary: 0xff8b76, secondary: 0x54d9df, gold: 0xffe390, deep: 0x071c30 },
  forest: { primary: 0xf59a70, secondary: 0xa8e58a, gold: 0xffd67a, deep: 0x0c211d },
  dinosaur: { primary: 0xff9c63, secondary: 0xd0df7b, gold: 0xffd377, deep: 0x1a2015 },
}

function seeded(index) {
  const value = Math.sin(index * 927.41 + 17.13) * 43758.5453
  return value - Math.floor(value)
}

function makeMaterial(color, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.42,
    metalness: options.metalness ?? 0.08,
    emissive: options.emissive ?? 0x000000,
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  })
}

function addStarfield(scene, palette, amount = 260) {
  const positions = new Float32Array(amount * 3)
  const colors = new Float32Array(amount * 3)
  const base = new THREE.Color(palette.secondary)
  const warm = new THREE.Color(palette.gold)
  for (let index = 0; index < amount; index += 1) {
    const radius = 5.2 + seeded(index + 1) * 5.5
    const theta = seeded(index + 2) * Math.PI * 2
    const y = (seeded(index + 3) - 0.5) * 6.5
    positions[index * 3] = Math.cos(theta) * radius
    positions[index * 3 + 1] = y
    positions[index * 3 + 2] = Math.sin(theta) * radius - 2
    const color = seeded(index + 4) > 0.72 ? warm : base
    colors[index * 3] = color.r
    colors[index * 3 + 1] = color.g
    colors[index * 3 + 2] = color.b
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const material = new THREE.PointsMaterial({ size: 0.045, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true })
  const points = new THREE.Points(geometry, material)
  scene.add(points)
  return points
}

function addRing(scene, radius, color, rotation, opacity = 0.36) {
  const geometry = new THREE.TorusGeometry(radius, 0.012, 8, 96)
  const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity })
  const ring = new THREE.Mesh(geometry, material)
  ring.rotation.set(rotation[0], rotation[1], rotation[2])
  scene.add(ring)
  return ring
}

function addCake(scene, palette, candlesOut) {
  const group = new THREE.Group()
  group.position.set(0, -0.96, 0)
  group.rotation.y = -0.22
  scene.add(group)
  const physical = (color, options = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: options.roughness ?? 0.32, metalness: options.metalness ?? 0.02, clearcoat: options.clearcoat ?? 0.28, clearcoatRoughness: options.clearcoatRoughness ?? 0.22, emissive: options.emissive ?? 0x000000, emissiveIntensity: options.emissiveIntensity ?? 0, transparent: options.transparent ?? false, opacity: options.opacity ?? 1 })
  const mark = (mesh, cast = true, receive = true) => { mesh.castShadow = cast; mesh.receiveShadow = receive; group.add(mesh); return mesh }
  const lathe = (points, material) => mark(new THREE.Mesh(new THREE.LatheGeometry(points.map(([radius, y]) => new THREE.Vector2(radius, y)), 96), material))

  const plate = mark(new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.84, 0.12, 96), physical(0xfaf4e7, { roughness: 0.18, metalness: 0.16, clearcoat: 0.55 })), false, true)
  plate.position.y = -0.09
  const plateEdge = mark(new THREE.Mesh(new THREE.TorusGeometry(1.66, 0.055, 12, 96), physical(palette.secondary, { emissive: palette.secondary, emissiveIntensity: 0.48, metalness: 0.25 })))
  plateEdge.rotation.x = Math.PI / 2
  plateEdge.position.y = -0.01

  const bottom = lathe([[0, 0], [1.18, 0], [1.34, 0.1], [1.38, 0.24], [1.38, 0.7], [1.34, 0.84], [1.22, 0.9], [0, 0.9]], physical(palette.primary, { roughness: 0.3, clearcoat: 0.4 }))
  bottom.position.y = 0.02
  const bottomBand = mark(new THREE.Mesh(new THREE.TorusGeometry(1.365, 0.052, 12, 96), physical(palette.gold, { emissive: palette.gold, emissiveIntensity: 0.35, metalness: 0.28 })))
  bottomBand.rotation.x = Math.PI / 2
  bottomBand.position.y = 0.37

  const cream = 0xfff6df
  const bottomIcing = lathe([[0, 0], [1.2, 0], [1.31, 0.08], [1.31, 0.19], [1.22, 0.27], [1.08, 0.22], [0.94, 0.28], [0.78, 0.21], [0.6, 0.27], [0.42, 0.22], [0.22, 0.27], [0, 0.25]], physical(cream, { roughness: 0.2, clearcoat: 0.46 }))
  bottomIcing.position.y = 0.77

  const top = lathe([[0, 0], [0.7, 0], [0.83, 0.1], [0.88, 0.22], [0.88, 0.66], [0.82, 0.75], [0.72, 0.8], [0, 0.8]], physical(palette.secondary, { roughness: 0.3, clearcoat: 0.4 }))
  top.position.y = 0.91
  const topIcing = lathe([[0, 0], [0.72, 0], [0.82, 0.08], [0.82, 0.18], [0.75, 0.27], [0.63, 0.21], [0.5, 0.3], [0.36, 0.2], [0.22, 0.28], [0, 0.25]], physical(cream, { roughness: 0.18, clearcoat: 0.5 }))
  topIcing.position.y = 1.56

  const topBand = mark(new THREE.Mesh(new THREE.TorusGeometry(0.84, 0.035, 10, 64), physical(palette.gold, { emissive: palette.gold, emissiveIntensity: 0.3, metalness: 0.24 })))
  topBand.rotation.x = Math.PI / 2
  topBand.position.y = 1.2

  const berryMaterial = physical(palette.primary, { roughness: 0.2, clearcoat: 0.58 })
  const berryAlt = physical(palette.gold, { roughness: 0.2, clearcoat: 0.58 })
  for (let index = 0; index < 10; index += 1) {
    const angle = index / 10 * Math.PI * 2 + 0.12
    const radius = index % 2 ? 1.03 : 0.74
    const berry = mark(new THREE.Mesh(new THREE.SphereGeometry(index % 3 ? 0.09 : 0.12, 20, 16), index % 2 ? berryMaterial : berryAlt))
    berry.scale.y = 0.72
    berry.position.set(Math.cos(angle) * radius, index % 2 ? 0.99 : 1.64, Math.sin(angle) * radius)
  }
  const center = mark(new THREE.Mesh(new THREE.SphereGeometry(0.22, 28, 20), physical(palette.primary, { emissive: palette.primary, emissiveIntensity: 0.18, clearcoat: 0.68 })))
  center.scale.y = 0.62
  center.position.y = 1.83
  const centerLeaf = mark(new THREE.Mesh(new THREE.SphereGeometry(0.12, 18, 12), physical(palette.secondary, { roughness: 0.25 })))
  centerLeaf.scale.set(1.7, 0.22, 0.55)
  centerLeaf.position.set(0.13, 1.98, 0.02)
  centerLeaf.rotation.z = -0.35

  const count = Math.min(12, Math.max(1, Number(candlesOut?.age || 6)))
  const actualCount = Math.min(9, Math.max(3, count))
  for (let index = 0; index < actualCount; index += 1) {
    const angle = index / actualCount * Math.PI * 2 + 0.18
    const radius = index % 2 ? 0.58 : 0.3
    const candleGroup = new THREE.Group()
    candleGroup.position.set(Math.cos(angle) * radius, 1.78, Math.sin(angle) * radius)
    candleGroup.rotation.z = Math.sin(index * 1.8) * 0.06
    const candleMaterial = physical(index % 2 ? palette.secondary : palette.primary, { roughness: 0.25, clearcoat: 0.35 })
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.06, 0.64, 24), candleMaterial)
    candle.position.y = 0.32
    candle.castShadow = true
    candleGroup.add(candle)
    for (let stripeIndex = 0; stripeIndex < 3; stripeIndex += 1) {
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.057, 0.012, 8, 24), physical(palette.gold, { emissive: palette.gold, emissiveIntensity: 0.28, metalness: 0.2 }))
      stripe.rotation.x = Math.PI / 2
      stripe.position.y = 0.15 + stripeIndex * 0.18
      stripe.castShadow = true
      candleGroup.add(stripe)
    }
    const wick = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 8), physical(0x3e2f2c, { roughness: 0.8 }))
    wick.position.y = 0.68
    candleGroup.add(wick)
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.105, 18, 14), physical(palette.gold, { emissive: palette.gold, emissiveIntensity: 2.8, roughness: 0.06, transparent: true, opacity: candlesOut.active ? 0 : 1 }))
    flame.scale.set(0.58, 1.5, 0.58)
    flame.position.y = 0.79
    flame.userData.isFlame = true
    candleGroup.add(flame)
    const flameLight = new THREE.PointLight(palette.gold, candlesOut.active ? 0 : 0.6, 1.8)
    flameLight.position.y = 0.78
    flameLight.userData.isFlameLight = true
    candleGroup.add(flameLight)
    candleGroup.userData.candleIndex = index
    group.add(candleGroup)
  }
  return group
}

function addRocket(scene, palette) {
  const group = new THREE.Group()
  group.position.set(0, 0.1, -0.25)
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.05, 8, 24), makeMaterial(palette.primary, { metalness: 0.25, roughness: 0.26 }))
  body.rotation.z = -0.35
  group.add(body)
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.43, 24, 16), makeMaterial(palette.gold, { emissive: palette.gold, emissiveIntensity: 0.18 }))
  nose.scale.y = 0.58
  nose.position.set(0.15, 0.6, 0)
  nose.rotation.z = -0.35
  group.add(nose)
  const window = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 12), makeMaterial(palette.secondary, { emissive: palette.secondary, emissiveIntensity: 1.2, metalness: 0.4 }))
  window.position.set(-0.12, 0.33, 0.38)
  group.add(window)
  const fin = makeMaterial(palette.secondary, { emissive: palette.secondary, emissiveIntensity: 0.24 })
  for (const side of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.46, 4), fin)
    wing.scale.x = 0.6
    wing.position.set(-0.27, -0.42, side * 0.32)
    wing.rotation.z = Math.PI / 2
    group.add(wing)
  }
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.48, 14), makeMaterial(palette.gold, { emissive: palette.gold, emissiveIntensity: 2 }))
  flame.position.set(-0.2, -0.82, 0)
  flame.rotation.z = Math.PI
  flame.userData.isFlame = true
  group.add(flame)
  scene.add(group)
  return group
}

function addFireworks(scene, palette) {
  const group = new THREE.Group()
  group.userData.bursts = []
  scene.add(group)
  const colors = [palette.primary, palette.secondary, palette.gold, 0xfff4d3]
  for (let burstIndex = 0; burstIndex < 4; burstIndex += 1) {
    const origin = new THREE.Vector3((burstIndex - 1.5) * 1.65, 1.25 + (burstIndex % 2) * 1.3, 0.9)
    const amount = 42
    const positions = new Float32Array(amount * 3)
    const velocities = []
    const color = new THREE.Color(colors[burstIndex])
    const colorArray = new Float32Array(amount * 3)
    for (let index = 0; index < amount; index += 1) {
      positions[index * 3] = origin.x
      positions[index * 3 + 1] = origin.y
      positions[index * 3 + 2] = origin.z
      const theta = seeded(burstIndex * 100 + index + 4) * Math.PI * 2
      const phi = Math.acos(2 * seeded(burstIndex * 100 + index + 5) - 1)
      const speed = 0.7 + seeded(burstIndex * 100 + index + 6) * 1.35
      velocities.push(new THREE.Vector3(Math.sin(phi) * Math.cos(theta) * speed, Math.cos(phi) * speed, Math.sin(phi) * Math.sin(theta) * speed))
      colorArray[index * 3] = color.r
      colorArray[index * 3 + 1] = color.g
      colorArray[index * 3 + 2] = color.b
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colorArray, 3))
    const material = new THREE.PointsMaterial({ size: 0.12, vertexColors: true, transparent: true, opacity: 0.98, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, sizeAttenuation: true })
    const points = new THREE.Points(geometry, material)
    points.userData.velocities = velocities
    points.userData.origin = origin
    points.userData.age = 0
    points.userData.delay = burstIndex * 0.18
    group.add(points)

    const sparkGroup = new THREE.Group()
    sparkGroup.userData.origin = origin
    sparkGroup.userData.age = 0
    sparkGroup.userData.delay = burstIndex * 0.18
    for (let index = 0; index < 18; index += 1) {
      const theta = seeded(burstIndex * 400 + index + 2) * Math.PI * 2
      const phi = Math.acos(2 * seeded(burstIndex * 400 + index + 3) - 1)
      const speed = 0.55 + seeded(burstIndex * 400 + index + 4) * 1.15
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.96, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false }))
      spark.userData.velocity = new THREE.Vector3(Math.sin(phi) * Math.cos(theta) * speed, Math.cos(phi) * speed, Math.sin(phi) * Math.sin(theta) * speed)
      sparkGroup.add(spark)
    }
    group.userData.bursts.push(sparkGroup)
    group.add(sparkGroup)
  }
  return group
}

function disposeObject(object) {
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose()
    if (child.material) {
      const materials = Array.isArray(child.material) ? child.material : [child.material]
      materials.forEach((material) => material.dispose())
    }
  })
}

export default function ThreeCelebration({ mode = 'ambient', theme = 'starlit', age = 6, candlesOut = false, celebrating = false }) {
  const containerRef = useRef(null)
  const candlesOutRef = useRef(candlesOut)
  const celebratingRef = useRef(celebrating)
  candlesOutRef.current = candlesOut
  celebratingRef.current = celebrating

  useEffect(() => {
    const container = containerRef.current
    if (!container) return undefined
    const palette = PALETTES[theme] || PALETTES.starlit
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100)
    camera.position.set(0, 0.22, 7.2)
    camera.lookAt(0, 0.35, 0)
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.className = 'three-celebration-canvas'
    renderer.domElement.setAttribute('aria-hidden', 'true')
    container.appendChild(renderer.domElement)

    const root = new THREE.Group()
    scene.add(root)
    const stars = addStarfield(root, palette, mode === 'cake' ? 330 : 230)
    addRing(root, 2.15, palette.secondary, [1.02, 0.25, -0.2], 0.28)
    addRing(root, 2.7, palette.gold, [0.48, -0.45, 0.42], 0.22)
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.05)
    scene.add(ambientLight)
    const keyLight = new THREE.PointLight(palette.gold, 3.2, 9)
    keyLight.position.set(1.9, 3.1, 3.2)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(1024, 1024)
    keyLight.shadow.camera.near = 0.1
    keyLight.shadow.camera.far = 18
    scene.add(keyLight)
    const rimLight = new THREE.PointLight(palette.secondary, 2.5, 8)
    rimLight.position.set(-3.1, 0.3, 1.5)
    scene.add(rimLight)

    const cake = mode === 'cake' ? addCake(root, palette, { active: candlesOut, age }) : null
    const rocket = mode === 'intro' ? addRocket(root, palette) : null
    const fireworks = (mode === 'cake' || mode === 'fireworks' || celebrating) ? addFireworks(root, palette) : null
    if (mode === 'memory') {
      const halo = new THREE.Mesh(new THREE.TorusGeometry(1.65, 0.025, 8, 96), makeMaterial(palette.secondary, { emissive: palette.secondary, emissiveIntensity: 1.4, transparent: true, opacity: 0.8 }))
      halo.rotation.x = Math.PI / 2
      halo.position.y = -0.05
      root.add(halo)
    }

    let frame = 0
    let lastTime = performance.now()
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const resize = () => {
      const width = Math.max(1, container.clientWidth)
      const height = Math.max(1, container.clientHeight)
      camera.aspect = width / height
      camera.updateProjectionMatrix()
      renderer.setSize(width, height, false)
    }
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    resize()
    const animate = (time) => {
      const delta = Math.min(0.05, (time - lastTime) / 1000)
      lastTime = time
      const elapsed = time / 1000
      root.rotation.y += delta * (reducedMotion ? 0.012 : 0.035)
      stars.rotation.y -= delta * 0.008
      stars.rotation.x = Math.sin(elapsed * 0.17) * 0.025
      if (rocket) {
        rocket.position.y = Math.sin(elapsed * 1.4) * 0.18
        rocket.rotation.z = -0.35 + Math.sin(elapsed * 0.8) * 0.07
      }
      if (cake) {
        cake.rotation.y += delta * (reducedMotion ? 0.015 : 0.08)
        cake.position.y = -0.82 + Math.sin(elapsed * 1.5) * 0.035
        cake.traverse((child) => {
          if (child.userData.isFlame) {
            const scale = 0.88 + Math.sin(elapsed * 10 + child.id) * 0.12
            child.scale.x = 0.65 * scale
            child.scale.z = 0.65 * scale
            const flameVisible = !candlesOutRef.current
            child.material.opacity = flameVisible ? 1 : 0
            child.scale.y = 1.45 + Math.sin(elapsed * 8 + child.id) * 0.18
          }
          if (child.userData.isFlameLight) child.intensity = candlesOutRef.current ? 0 : 0.55
        })
      }
      if (fireworks) {
        const celebrationActive = celebratingRef.current || mode === 'fireworks'
        fireworks.children.filter((child) => child.userData.velocities).forEach((points) => {
          if (!celebrationActive) { points.material.opacity = 0; points.userData.age = 0; return }
          points.userData.age += delta
          const age = Math.max(0, points.userData.age - points.userData.delay)
          const position = points.geometry.attributes.position
          points.userData.velocities.forEach((velocity, index) => {
            const i = index * 3
            position.array[i] = points.userData.origin.x + velocity.x * age
            position.array[i + 1] = points.userData.origin.y + velocity.y * age - age * age * 0.34
            position.array[i + 2] = points.userData.origin.z + velocity.z * age
          })
          position.needsUpdate = true
          points.material.opacity = age < 0.22 ? age / 0.22 : Math.max(0, 1 - (age - 0.22) / 1.6)
          if (points.userData.age > 2.1) points.userData.age = 0
        })
        fireworks.userData.bursts?.forEach((sparkGroup) => {
          if (!celebrationActive) { sparkGroup.userData.age = 0; sparkGroup.children.forEach((spark) => { spark.material.opacity = 0 }); return }
          sparkGroup.userData.age += delta
          const age = Math.max(0, sparkGroup.userData.age - sparkGroup.userData.delay)
          sparkGroup.children.forEach((spark) => {
            const velocity = spark.userData.velocity
            spark.position.set(sparkGroup.userData.origin.x + velocity.x * age, sparkGroup.userData.origin.y + velocity.y * age - age * age * 0.34, sparkGroup.userData.origin.z + velocity.z * age)
            spark.material.opacity = age < 0.2 ? age / 0.2 : Math.max(0, 1 - (age - 0.2) / 1.5)
          })
          if (sparkGroup.userData.age > 2.1) sparkGroup.userData.age = 0
        })
      }
      renderer.render(scene, camera)
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      if (cake) disposeObject(cake)
      if (rocket) disposeObject(rocket)
      if (fireworks) disposeObject(fireworks)
      disposeObject(root)
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [mode, theme, age])

  useEffect(() => {
    const canvas = containerRef.current?.querySelector('canvas')
    if (!canvas) return
    canvas.dataset.candles = candlesOutRef.current ? 'out' : 'lit'
    canvas.dataset.celebrating = celebratingRef.current ? 'yes' : 'no'
  }, [candlesOut, celebrating])

  return <div ref={containerRef} className={'three-celebration three-mode-' + mode} aria-hidden="true" />
}
