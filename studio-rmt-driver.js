(function(root){
'use strict';
// Standalone transmitter for the seller's ESP32 / 199 GRB LED wiring.
// References: ESP-IDF 4.4 legacy RMT and ESP-IDF 5.1 RMT TX/copy encoder APIs.
const reserved=new Set(('alignas alignof and and_eq asm auto bitand bitor bool break case catch char char8_t char16_t char32_t class compl concept const consteval constexpr constinit const_cast continue co_await co_return co_yield decltype default delete do double dynamic_cast else enum explicit export extern false float for friend goto if inline int long mutable namespace new noexcept not not_eq nullptr operator or or_eq private protected public register reinterpret_cast requires return short signed sizeof static static_assert static_cast std struct switch template this thread_local throw true try typedef typeid typename union unsigned using virtual void volatile wchar_t while xor xor_eq LampStudioKernel LampRmtSymbol setup loop Serial').split(' '));
// Known names introduced by the official Arduino-ESP32 / C headers used below.
// This deliberately does not try to infer macros defined in a seller's own firmware.
for(const name of (`HIGH LOW INPUT OUTPUT PULLUP PULLDOWN INPUT_PULLUP INPUT_PULLDOWN OPEN_DRAIN OUTPUT_OPEN_DRAIN ANALOG DISABLED
 RISING FALLING CHANGE ONLOW ONHIGH ONLOW_WE ONHIGH_WE DEFAULT EXTERNAL SERIAL DISPLAY LSBFIRST MSBFIRST
 PI HALF_PI TWO_PI DEG_TO_RAD RAD_TO_DEG EULER NOT_A_PIN NOT_A_PORT NOT_AN_INTERRUPT NOT_ON_TIMER
 NUM_DIGITAL_PINS NUM_ANALOG_INPUTS NUM_OUPUT_PINS PIN_DAC1 PIN_DAC2 LED_BUILTIN BUILTIN_LED TX RX SDA SCL SS MOSI MISO SCK
 ESP32 ARDUINO Arduino_h ARDUINO_ARCH_ESP32 ARDUINO_BOARD ARDUINO_VARIANT ARDUINO_USB_MODE ARDUINO_USB_CDC_ON_BOOT F_CPU
 ESP_ARDUINO_VERSION_MAJOR ESP_ARDUINO_VERSION_MINOR ESP_ARDUINO_VERSION_PATCH ESP_ARDUINO_VERSION ESP_ARDUINO_VERSION_VAL ESP_ARDUINO_VERSION_STR
 ESP_IDF_VERSION_MAJOR ESP_IDF_VERSION_MINOR ESP_IDF_VERSION_PATCH ESP_IDF_VERSION ESP_IDF_VERSION_VAL
 CONFIG_IDF_TARGET CONFIG_IDF_TARGET_ESP32 CONFIG_IDF_TARGET_ESP32S2 CONFIG_IDF_TARGET_ESP32S3 CONFIG_IDF_TARGET_ESP32C3 CONFIG_IDF_TARGET_ESP32C6
 ESP_OK ESP_FAIL ESP_ERR_INVALID_ARG ESP_ERR_INVALID_STATE ESP_ERR_TIMEOUT ESP_ERR_NO_MEM ESP_ERR_NOT_FOUND ESP_ERR_NOT_SUPPORTED
 RMT_MODE_TX RMT_MODE_RX RMT_CLK_SRC_DEFAULT RMT_CLK_SRC_APB RMT_BASECLK_APB RMT_CARRIER_LEVEL_LOW RMT_IDLE_LEVEL_LOW
 GPIO_IS_VALID_GPIO GPIO_IS_VALID_OUTPUT_GPIO GPIO_MODE_INPUT GPIO_MODE_OUTPUT GPIO_MODE_OUTPUT_OD GPIO_NUM_MAX
 NULL PROGMEM PSTR FPSTR F IRAM_ATTR DRAM_ATTR RTC_DATA_ATTR UINT8_MAX UINT16_MAX UINT32_MAX UINT64_MAX INT8_MAX INT16_MAX INT32_MAX INT64_MAX SIZE_MAX
 NAN INFINITY HUGE_VAL HUGE_VALF HUGE_VALL FP_INFINITE FP_NAN FP_NORMAL FP_SUBNORMAL FP_ZERO M_PI M_PI_2 M_PI_4 M_E M_LOG2E M_LOG10E M_LN2 M_LN10 M_SQRT2
 boolean byte word uint8_t uint16_t uint32_t uint64_t int8_t int16_t int32_t int64_t size_t ptrdiff_t intptr_t uintptr_t intmax_t uintmax_t float_t double_t
 esp_err_t gpio_num_t rmt_channel_t rmt_item32_t rmt_symbol_word_t rmt_channel_handle_t rmt_encoder_handle_t rmt_config_t rmt_tx_config_t rmt_tx_channel_config_t rmt_copy_encoder_config_t rmt_transmit_config_t
 Serial0 Serial1 Serial2 Serial3 HardwareSerial String Print Stream IPAddress EspClass ESP
 millis micros delay delayMicroseconds yield pinMode digitalRead digitalWrite analogRead analogWrite attachInterrupt detachInterrupt pulseIn pulseInLong
 map random randomSeed makeWord tone noTone constrain radians degrees sq min max abs labs llabs isfinite isinf isnan isnormal signbit fpclassify isgreater isgreaterequal isless islessequal islessgreater isunordered
`).trim().split(/\s+/))reserved.add(name);
for(const base of ('sin cos tan asin acos atan atan2 sinh cosh tanh asinh acosh atanh exp exp2 expm1 log log2 log10 log1p pow sqrt cbrt hypot ceil floor trunc round lround llround nearbyint rint lrint llrint fabs fmod remainder remquo copysign nan nextafter nexttoward fdim fmax fmin fma frexp ldexp modf scalbn scalbln erf erfc tgamma lgamma').split(' ')){
 for(const suffix of ['', 'f', 'l'])reserved.add(base+suffix);
}
for(let pin=0;pin<=48;pin++)reserved.add('GPIO_NUM_'+pin);
for(let channel=0;channel<8;channel++)reserved.add('RMT_CHANNEL_'+channel);
function code(options={}){
 if(!options||typeof options!=='object'||Array.isArray(options))throw Error('RMT 导出选项无效');
 const pin=options.pin===undefined?18:options.pin,name=options.namespaceName===undefined?'LampEffect':options.namespaceName;
 if(!Number.isInteger(pin)||pin<0||pin>48)throw Error('RMT 引脚须为 0–48 的整数；实际可用输出引脚由目标 ESP32 型号检查，默认 GPIO 18');
 if(typeof name!=='string'||!/^[A-Za-z][A-Za-z0-9_]{0,47}$/.test(name)||name.includes('__')||reserved.has(name)||name.startsWith('lampRmt'))throw Error('RMT 模块名须为有效且不保留的 C++ 名称');
 return `
// LAMP_STUDIO_RMT_DRIVER_V1
// Standalone lamp diagnostic sketch, not a replacement for the seller's full firmware.
// For an existing product firmware, integrate the effect .h and keep its one RMT driver.
// Target: Arduino-ESP32 2.x or 3.x, GPIO ${pin}, 199 WS2812 GRB LEDs.
// The selected ESP32 model must support the GPIO and the requested 40 MHz RMT clock.
// Seller timing: 40 MHz ticks, zero=16H+34L, one=32H+18L, latch=60 us LOW.
// Project brightness is already applied by renderFrame. Do not scale or gamma it again.
#include <Arduino.h>
#include <esp_arduino_version.h>
#include <esp_err.h>
#include <stdint.h>
#include <driver/gpio.h>

#if !defined(ARDUINO_ARCH_ESP32)
#error "This seller RMT profile requires an Arduino-ESP32 board."
#endif
#if ESP_ARDUINO_VERSION_MAJOR < 2 || ESP_ARDUINO_VERSION_MAJOR > 3
#error "Select an Arduino-ESP32 2.x or 3.x board package for this RMT sketch."
#endif

#if ESP_ARDUINO_VERSION_MAJOR >= 3
#include <driver/rmt_tx.h>
#include <driver/rmt_encoder.h>
typedef rmt_symbol_word_t LampRmtSymbol;
static rmt_channel_handle_t lampRmtChannel = NULL;
static rmt_encoder_handle_t lampRmtEncoder = NULL;
#else
#include <driver/rmt.h>
typedef rmt_item32_t LampRmtSymbol;
static constexpr rmt_channel_t lampRmtChannel = RMT_CHANNEL_0;
#endif

static_assert(${name}::LED_COUNT == 199, "Seller profile expects exactly 199 controllable LEDs.");
static_assert(${name}::FRAME_COUNT > 0 && ${name}::FPS > 0, "Effect timing must be positive.");
static_assert(sizeof(LampRmtSymbol) == 4, "RMT symbols must be 32 bits.");
static constexpr uint8_t lampRmtDataPin = ${pin};
static constexpr size_t lampRmtSymbolCount = ${name}::LED_COUNT * 24u + 1u;
// Exactly one frame's pulse buffer (19108 B) and RGB buffer (597 B), not a movie.
static LampRmtSymbol lampRmtSymbols[lampRmtSymbolCount] = {};
static ${name}::RGB lampRmtPixels[${name}::LED_COUNT] = {};
static bool lampRmtReady = false;
static bool lampRmtBusy = false;
static esp_err_t lampRmtError = ESP_OK;
static const char* lampRmtErrorStage = "none";
static bool lampRmtErrorPrinted = false;
static uint32_t lampRmtErrorPrintedMs = 0;
static uint32_t lampRmtPreviousUs = 0;
static uint64_t lampRmtClockUnits = 0;
static uint32_t lampRmtLastFrame = UINT32_MAX;

// Explicit declarations also keep Arduino's sketch preprocessor from moving type-dependent prototypes.
static void lampRmtReportError();
static bool lampRmtCheck(esp_err_t result, const char* stage);
static bool lampRmtBegin();
static void lampRmtEncode();
static esp_err_t lampRmtWait(uint32_t timeoutMs);
static bool lampRmtStartSend();
void setup();
void loop();

static void lampRmtReportError() {
  if (lampRmtError == ESP_OK) return;
  const uint32_t now = millis();
  if (!lampRmtErrorPrinted || uint32_t(now - lampRmtErrorPrintedMs) >= 5000u) {
    Serial.printf("[Lamp RMT] %s failed: %s (0x%X). Output stopped; reset after fixing configuration.\\n",
                  lampRmtErrorStage, esp_err_to_name(lampRmtError), unsigned(lampRmtError));
    lampRmtErrorPrinted = true;
    lampRmtErrorPrintedMs = now;
  }
}

static bool lampRmtCheck(esp_err_t result, const char* stage) {
  if (result == ESP_OK) return true;
  // Latch failure. Never mutate a pulse buffer that a failed/pending TX may still own.
  lampRmtReady = false;
  lampRmtError = result;
  lampRmtErrorStage = stage;
  lampRmtReportError();
  return false;
}

static bool lampRmtBegin() {
  if (!lampRmtCheck(GPIO_IS_VALID_OUTPUT_GPIO(lampRmtDataPin) ? ESP_OK : ESP_ERR_INVALID_ARG,
                    "GPIO is not an output on this ESP32 model")) return false;
#if defined(CONFIG_IDF_TARGET_ESP32)
  // Classic ESP32: SPI flash occupies GPIO 6-11 and Serial diagnostics use GPIO 1/3.
  if (!lampRmtCheck(((lampRmtDataPin >= 6 && lampRmtDataPin <= 11) ||
                     lampRmtDataPin == 1 || lampRmtDataPin == 3) ? ESP_ERR_INVALID_ARG : ESP_OK,
                    "GPIO conflicts with classic ESP32 flash or Serial")) return false;
#endif
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  rmt_tx_channel_config_t cfg = {};
  cfg.gpio_num = gpio_num_t(lampRmtDataPin);
  cfg.clk_src = RMT_CLK_SRC_DEFAULT;
  cfg.resolution_hz = 40000000;
  cfg.mem_block_symbols = 64;
  cfg.trans_queue_depth = 1;
  cfg.flags.invert_out = false;
  cfg.flags.with_dma = false;
  if (!lampRmtCheck(rmt_new_tx_channel(&cfg, &lampRmtChannel), "rmt_new_tx_channel")) return false;
  rmt_copy_encoder_config_t encoderCfg = {};
  if (!lampRmtCheck(rmt_new_copy_encoder(&encoderCfg, &lampRmtEncoder), "rmt_new_copy_encoder")) return false;
  return lampRmtCheck(rmt_enable(lampRmtChannel), "rmt_enable");
#else
  rmt_config_t cfg = {};
  cfg.rmt_mode = RMT_MODE_TX;
  cfg.channel = lampRmtChannel;
  cfg.gpio_num = gpio_num_t(lampRmtDataPin);
  cfg.clk_div = 2; // 80 MHz APB / 2 = 40 MHz, matching the seller.
  cfg.mem_block_num = 1;
  cfg.tx_config.loop_en = false;
  cfg.tx_config.carrier_freq_hz = 0;
  cfg.tx_config.carrier_duty_percent = 0;
  cfg.tx_config.carrier_level = RMT_CARRIER_LEVEL_LOW;
  cfg.tx_config.carrier_en = false;
  cfg.tx_config.idle_level = RMT_IDLE_LEVEL_LOW;
  cfg.tx_config.idle_output_en = true;
  if (!lampRmtCheck(rmt_config(&cfg), "rmt_config")) return false;
  if (!lampRmtCheck(rmt_set_source_clk(lampRmtChannel, RMT_BASECLK_APB), "rmt_set_source_clk")) return false;
  if (!lampRmtCheck(rmt_driver_install(lampRmtChannel, 0, 0), "rmt_driver_install")) return false;
  uint32_t clockHz = 0;
  if (!lampRmtCheck(rmt_get_counter_clock(lampRmtChannel, &clockHz), "rmt_get_counter_clock")) return false;
  return lampRmtCheck(clockHz == 40000000u ? ESP_OK : ESP_ERR_INVALID_STATE, "40 MHz clock check");
#endif
}

static void lampRmtEncode() {
  size_t out = 0;
  // renderFrame is already in physical wire order. No second XY/snake conversion.
  for (uint16_t i = 0; i < ${name}::LED_COUNT; ++i) {
    const uint8_t bytes[3] = {lampRmtPixels[i].g, lampRmtPixels[i].r, lampRmtPixels[i].b};
    for (uint8_t channel = 0; channel < 3; ++channel) {
      for (int bit = 7; bit >= 0; --bit) {
        const bool one = (bytes[channel] & (uint8_t(1u) << bit)) != 0;
        LampRmtSymbol& symbol = lampRmtSymbols[out++];
        symbol.level0 = 1;
        symbol.duration0 = one ? 32 : 16;
        symbol.level1 = 0;
        symbol.duration1 = one ? 18 : 34;
      }
    }
  }
  // Two nonzero low halves avoid a zero-duration end marker: 2400 ticks = 60 us.
  LampRmtSymbol& reset = lampRmtSymbols[out];
  reset.level0 = 0;
  reset.duration0 = 1200;
  reset.level1 = 0;
  reset.duration1 = 1200;
}

static esp_err_t lampRmtWait(uint32_t timeoutMs) {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  return rmt_tx_wait_all_done(lampRmtChannel, int(timeoutMs));
#else
  return rmt_wait_tx_done(lampRmtChannel, pdMS_TO_TICKS(timeoutMs));
#endif
}

static bool lampRmtStartSend() {
#if ESP_ARDUINO_VERSION_MAJOR >= 3
  rmt_transmit_config_t tx = {};
  tx.loop_count = 0;
  tx.flags.eot_level = 0;
  if (!lampRmtCheck(rmt_transmit(lampRmtChannel, lampRmtEncoder, lampRmtSymbols,
                                sizeof(lampRmtSymbols), &tx), "rmt_transmit")) return false;
#else
  if (!lampRmtCheck(rmt_write_items(lampRmtChannel, lampRmtSymbols,
                                   int(lampRmtSymbolCount), false), "rmt_write_items")) return false;
#endif
  lampRmtBusy = true;
  return true;
}

void setup() {
  Serial.begin(115200);
  if (!lampRmtBegin()) return;
  lampRmtEncode(); // Static RGB buffer starts black. Clear all 199 LEDs before playback.
  if (!lampRmtStartSend()) return;
  // One bounded startup wait; normal playback polls TX completion without frame delays.
  if (!lampRmtCheck(lampRmtWait(100), "startup black frame")) return;
  lampRmtBusy = false;
  lampRmtPreviousUs = micros();
  lampRmtClockUnits = 0;
  lampRmtLastFrame = UINT32_MAX;
  lampRmtReady = true;
}

void loop() {
  if (!lampRmtReady) { lampRmtReportError(); yield(); return; }
  const uint32_t nowUs = micros();
  const uint32_t deltaUs = uint32_t(nowUs - lampRmtPreviousUs);
  lampRmtPreviousUs = nowUs;
  // Integer frame numerator preserves exact 30/60 FPS fractions and micros() wrap.
  // The loop must run at least once per micros() wrap (~71 min), as usual on ESP32.
  const uint64_t cycleUnits = uint64_t(${name}::FRAME_COUNT) * 1000000u;
  lampRmtClockUnits = (lampRmtClockUnits + uint64_t(deltaUs) * ${name}::FPS) % cycleUnits;
  if (lampRmtBusy) {
    const esp_err_t pending = lampRmtWait(0);
    if (pending == ESP_ERR_TIMEOUT) { yield(); return; }
    if (!lampRmtCheck(pending, "TX completion")) return;
    lampRmtBusy = false;
  }
  const uint32_t frame = uint32_t(lampRmtClockUnits / 1000000u);
  if (frame == lampRmtLastFrame) { yield(); return; }
  // If a render or transmission took longer than a frame, jump to current time.
  // Do not replay missed frames and build a backlog that slows the animation.
  ${name}::renderFrame(frame, lampRmtPixels);
  lampRmtEncode();
  if (lampRmtStartSend()) lampRmtLastFrame = frame;
  yield();
}
`;
}
root.StudioRmtDriver={code};
if(typeof module!=='undefined')module.exports=root.StudioRmtDriver;
})(typeof globalThis!=='undefined'?globalThis:this);
