import { registerNodeType } from '../registry'
import { Gradient } from './generators/Gradient'
import { ImageFile } from './generators/ImageFile'
import { Noise } from './generators/Noise'
import { SolidColour } from './generators/SolidColour'
import { Strobe } from './generators/Strobe'
import { VideoFile } from './generators/VideoFile'
import { Wave } from './generators/Wave'
import { Chase } from './generators/Chase'
import { Comet } from './generators/Comet'
import { Twinkle } from './generators/Twinkle'
import { Mask } from './transforms/Mask'
import { Mirror } from './transforms/Mirror'
import { Offset } from './transforms/Offset'
import { Rotate } from './transforms/Rotate'
import { Blur } from './transforms/Blur'
import { Scale } from './transforms/Scale'
import { Transform } from './transforms/Transform'
import { Kaleidoscope } from './transforms/Kaleidoscope'
import { Displace } from './transforms/Displace'
import { Add } from './compositing/Add'
import { Multiply } from './compositing/Multiply'
import { Over } from './compositing/Over'
import { Screen } from './compositing/Screen'
import { Mix } from './compositing/Mix'
import { Feedback } from './compositing/Feedback'
import { Merge } from './compositing/Merge'
import { ColourCorrect } from './colour/ColourCorrect'
import { Curves } from './colour/Curves'
import { HsvShift } from './colour/HsvShift'
import { Levels } from './colour/Levels'
import { PaletteMap } from './colour/PaletteMap'
import { Luminance } from './colour/Luminance'
import { ColourFromValue } from './colour/ColourFromValue'
import { Delay } from './time/Delay'
import { Hold } from './time/Hold'
import { Ramp } from './time/Ramp'
import { Lfo } from './time/Lfo'
import { BpmClock } from './time/BpmClock'
import { Timeline } from './time/Timeline'
import { AudioIn } from './audio/AudioIn'
import { Beat } from './audio/Beat'
import { Cylindrical } from './spatial/Cylindrical'
import { DistanceField } from './spatial/DistanceField'
import { Spherical } from './spatial/Spherical'
import { Compare } from './logic/Compare'
import { Gate } from './logic/Gate'
import { Switch } from './logic/Switch'
import { SwitchFloat } from './logic/SwitchFloat'
import { Constant } from './math/Constant'
import { Remap } from './math/Remap'
import { MathOp } from './math/MathOp'
import { Smooth } from './math/Smooth'
import { Random } from './math/Random'
import { Sequence } from './sequence/Sequence'
import { Schedule } from './schedule/Schedule'
import { Resolution } from './setup/Resolution'
import { Fixture } from './setup/Fixture'
import { Master } from './setup/Master'
import { Component } from './setup/Component'
import { ComponentIn } from './setup/ComponentIn'
import { ComponentOut } from './setup/ComponentOut'
import { Text } from './generators/Text'
import { Fire } from './generators/Fire'
import { PixelSort } from './transforms/PixelSort'
import { MidiIn } from './input/MidiIn'
import { KeyboardIn } from './input/KeyboardIn'
import { OscIn } from './input/OscIn'
import { PixelOutput } from './output/PixelOutput'

export const COMPONENT_IN_NODE_TYPE = ComponentIn.type
export const COMPONENT_OUT_NODE_TYPE = ComponentOut.type
export const COMPONENT_NODE_TYPE = Component.type

/** Hidden from the palette unless editing inside a component. */
export const INTERNAL_NODE_TYPES = new Set<string>([COMPONENT_IN_NODE_TYPE, COMPONENT_OUT_NODE_TYPE])

let registered = false

/** Idempotent; called once by both the renderer and the engine host. */
export function registerStandardNodes(): void {
  if (registered) return
  registered = true

  registerNodeType(SolidColour)
  registerNodeType(Gradient)
  registerNodeType(Wave)
  registerNodeType(Noise)
  registerNodeType(Strobe)
  registerNodeType(VideoFile)
  registerNodeType(ImageFile)
  registerNodeType(Chase)
  registerNodeType(Comet)
  registerNodeType(Twinkle)
  registerNodeType(Text)
  registerNodeType(Fire)

  registerNodeType(Transform)
  registerNodeType(Mirror)
  registerNodeType(Offset)
  registerNodeType(Scale)
  registerNodeType(Rotate)
  registerNodeType(Blur)
  registerNodeType(Mask)
  registerNodeType(Kaleidoscope)
  registerNodeType(Displace)
  registerNodeType(PixelSort)

  registerNodeType(Mix)
  registerNodeType(Feedback)
  registerNodeType(Add)
  registerNodeType(Multiply)
  registerNodeType(Screen)
  registerNodeType(Over)
  registerNodeType(Merge)

  registerNodeType(HsvShift)
  registerNodeType(Levels)
  registerNodeType(Curves)
  registerNodeType(PaletteMap)
  registerNodeType(ColourCorrect)
  registerNodeType(Luminance)
  registerNodeType(ColourFromValue)

  registerNodeType(Lfo)
  registerNodeType(BpmClock)
  registerNodeType(Timeline)
  registerNodeType(Delay)
  registerNodeType(Hold)
  registerNodeType(Ramp)

  registerNodeType(AudioIn)
  registerNodeType(Beat)
  registerNodeType(MidiIn)
  registerNodeType(KeyboardIn)
  registerNodeType(OscIn)
  registerNodeType(Sequence)
  registerNodeType(Schedule)

  registerNodeType(Cylindrical)
  registerNodeType(Spherical)
  registerNodeType(DistanceField)

  registerNodeType(Compare)
  registerNodeType(Switch)
  registerNodeType(SwitchFloat)
  registerNodeType(Gate)

  registerNodeType(Constant)
  registerNodeType(Remap)
  registerNodeType(MathOp)
  registerNodeType(Smooth)
  registerNodeType(Random)

  registerNodeType(Resolution)
  registerNodeType(Fixture)
  registerNodeType(Master)
  registerNodeType(Component)
  registerNodeType(ComponentIn)
  registerNodeType(ComponentOut)
  registerNodeType(PixelOutput)
}

export const OUTPUT_NODE_TYPE = PixelOutput.type
