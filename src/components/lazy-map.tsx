import dynamic from 'next/dynamic'

// Lazy-load the map component to reduce initial bundle size
const MotoMap = dynamic(() => import('@/components/moto-map'), { ssr: false })

export default MotoMap
