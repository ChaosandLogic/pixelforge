#ifdef __APPLE__
#import <Foundation/Foundation.h>
#import <Metal/Metal.h>
#import <IOSurface/IOSurface.h>
#import <objc/message.h>
#include <pthread.h>
#include <stdlib.h>
#include <string.h>

static NSBundle *gBundle = nil;
static id gDevice = nil;
static id gQueue = nil;
static NSMutableDictionary *gClients = nil;
static NSMutableDictionary *gClientUUIDs = nil;
static NSMutableDictionary *gServers = nil;
static NSMutableDictionary *gTextures = nil;
static NSLock *gFrameLock = nil;
static NSMutableDictionary *gFrames = nil;
static CFRunLoopRef gSyphonLoop = NULL;
static int gLoadOk = 0;
static BOOL gLoggedEmpty = NO;

static NSString *pf_string(const char *s) {
  if (!s) return @"";
  return [NSString stringWithUTF8String:s];
}

static int pf_try(int (^block)(void)) {
  @try {
    return block();
  } @catch (NSException *e) {
    NSLog(@"[gpu-engine] syphon: %@", e.reason);
    return 0;
  }
}

static id pf_retained_return(NSInvocation *inv) {
  void *raw = NULL;
  [inv getReturnValue:&raw];
  if (!raw) return nil;
  return (__bridge_transfer id)CFRetain(raw);
}

static id pf_call(id target, SEL sel) {
  if (!target || ![target respondsToSelector:sel]) return nil;
  NSMethodSignature *sig = [target methodSignatureForSelector:sel];
  if (!sig || sig.methodReturnLength == 0) return nil;
  NSInvocation *inv = [NSInvocation invocationWithMethodSignature:sig];
  [inv setSelector:sel];
  [inv setTarget:target];
  [inv invoke];
  if (sig.methodReturnType[0] != '@') return nil;
  return pf_retained_return(inv);
}

static NSString *pf_framework_string(const char *symbol, NSString *fallback) {
  if (!gBundle) return fallback;
  CFBundleRef cf = CFBundleGetBundleWithIdentifier((__bridge CFStringRef)gBundle.bundleIdentifier);
  if (!cf) cf = CFBundleCreate(kCFAllocatorDefault, (__bridge CFURLRef)gBundle.bundleURL);
  if (!cf) return fallback;
  void *ptr = CFBundleGetDataPointerForName(cf, (__bridge CFStringRef)@(symbol));
  if (!ptr) return fallback;
  NSString *value = *(__unsafe_unretained NSString **)ptr;
  return [value isKindOfClass:[NSString class]] && value.length ? value : fallback;
}

static NSString *pf_dict_str(NSDictionary *desc, NSString *key) {
  if (!key) return nil;
  id value = desc[key];
  return [value isKindOfClass:[NSString class]] && [value length] ? value : nil;
}

static NSString *pf_desc_field(NSDictionary *desc, const char *symbol, NSString *fallbackKey) {
  NSString *value = pf_dict_str(desc, pf_framework_string(symbol, fallbackKey));
  if (value) return value;
  return pf_dict_str(desc, fallbackKey);
}

static NSString *pf_sender_app(NSDictionary *desc) {
  return pf_desc_field(desc, "SyphonServerDescriptionAppNameKey", @"SyphonServerDescriptionAppNameKey");
}

static NSString *pf_sender_raw_name(NSDictionary *desc) {
  NSString *name = pf_desc_field(desc, "SyphonServerDescriptionNameKey", @"SyphonServerDescriptionNameKey");
  if (name) return name;
  return pf_dict_str(desc, @"name");
}

static NSString *pf_sender_uuid(NSDictionary *desc) {
  NSString *uuid = pf_desc_field(desc, "SyphonServerDescriptionUUIDKey", @"SyphonServerDescriptionUUIDKey");
  if (uuid) return uuid;
  return pf_dict_str(desc, @"uuid");
}

static NSString *pf_sender_label(NSDictionary *desc) {
  NSString *name = pf_sender_raw_name(desc);
  NSString *app = pf_sender_app(desc);
  if (app.length && name.length && ![app isEqualToString:name]) {
    return [NSString stringWithFormat:@"%@ — %@", app, name];
  }
  if (name.length) return name;
  if (app.length) return app;
  for (id key in desc) {
    id value = desc[key];
    if (![value isKindOfClass:[NSString class]] || [value length] == 0) continue;
    NSString *k = [key isKindOfClass:[NSString class]] ? key : @"";
    if ([k localizedCaseInsensitiveContainsString:@"uuid"]) continue;
    if ([k localizedCaseInsensitiveContainsString:@"icon"]) continue;
    return value;
  }
  return nil;
}

static BOOL pf_name_matches(NSDictionary *desc, NSString *wanted) {
  if (!wanted.length) return NO;
  NSString *name = pf_sender_raw_name(desc);
  NSString *app = pf_sender_app(desc);
  NSString *uuid = pf_sender_uuid(desc);
  NSString *label = pf_sender_label(desc);
  if (name && [wanted isEqualToString:name]) return YES;
  if (app && [wanted isEqualToString:app]) return YES;
  if (uuid && [wanted isEqualToString:uuid]) return YES;
  if (label && [wanted isEqualToString:label]) return YES;
  if (app.length && name.length) {
    NSString *dash = [NSString stringWithFormat:@"%@ - %@", app, name];
    NSString *colon = [NSString stringWithFormat:@"%@: %@", app, name];
    if ([wanted isEqualToString:dash] || [wanted isEqualToString:colon]) return YES;
  }
  return NO;
}

static NSArray *pf_servers(void) {
  Class dirClass = NSClassFromString(@"SyphonServerDirectory");
  if (!dirClass) return nil;
  id dir = pf_call(dirClass, @selector(sharedDirectory));
  return pf_call(dir, @selector(servers));
}

static NSDictionary *pf_desc_for_name(NSString *name) {
  NSArray *servers = pf_servers();
  for (NSDictionary *desc in servers) {
    if (![desc isKindOfClass:[NSDictionary class]]) continue;
    if (pf_name_matches(desc, name)) return desc;
  }
  return nil;
}

static NSString *pf_pick_framework_path(void) {
  NSMutableArray *tryPaths = [NSMutableArray array];
  const char *env = getenv("PIXELFORGE_SYPHON_FRAMEWORK");
  if (env && env[0]) [tryPaths addObject:pf_string(env)];
  NSString *beside = [[[NSBundle mainBundle] bundlePath] stringByAppendingPathComponent:@"../Frameworks/Syphon.framework"];
  if (beside) [tryPaths addObject:beside];
  NSString *resource = [[NSBundle mainBundle] pathForResource:@"Syphon" ofType:@"framework"];
  if (resource) [tryPaths addObject:resource];
  [tryPaths addObject:@"/Library/Frameworks/Syphon.framework"];
  [tryPaths addObject:@"/Users/Shared/Syphon.framework"];
  for (NSString *p in tryPaths) {
    NSBundle *b = [NSBundle bundleWithPath:p];
    if (b && [b preflightAndReturnError:nil]) return p;
    if ([[NSFileManager defaultManager] fileExistsAtPath:p]) return p;
  }
  return nil;
}

static void *pf_syphon_thread_main(void *arg) {
  dispatch_semaphore_t ready = (__bridge dispatch_semaphore_t)arg;
  @autoreleasepool {
    NSString *path = pf_pick_framework_path();
    NSBundle *b = path ? [NSBundle bundleWithPath:path] : nil;
    BOOL loaded = NO;
    @try {
      loaded = b && [b load];
    } @catch (NSException *e) {
      loaded = NO;
    }
    if (loaded) {
      gBundle = b;
      gDevice = MTLCreateSystemDefaultDevice();
      gQueue = [gDevice newCommandQueue];
      gClients = [NSMutableDictionary dictionary];
      gClientUUIDs = [NSMutableDictionary dictionary];
      gServers = [NSMutableDictionary dictionary];
      gTextures = [NSMutableDictionary dictionary];
      gFrameLock = [[NSLock alloc] init];
      gFrames = [NSMutableDictionary dictionary];
      Class dirClass = NSClassFromString(@"SyphonServerDirectory");
      id dir = pf_call(dirClass, @selector(sharedDirectory));
      (void)dir;
      [[NSDistributedNotificationCenter defaultCenter]
          postNotificationName:@"SyphonServerAnnounceRequest"
                        object:nil
                      userInfo:nil
            deliverImmediately:YES];
      gSyphonLoop = CFRunLoopGetCurrent();
      gLoadOk = gDevice ? 1 : 0;
    }
    dispatch_semaphore_signal(ready);
    if (gLoadOk) {
      NSRunLoop *rl = [NSRunLoop currentRunLoop];
      [rl addPort:[NSMachPort port] forMode:NSRunLoopCommonModes];
      [rl run];
    }
  }
  return NULL;
}

int pf_syphon_load(void) {
  static dispatch_once_t once;
  dispatch_once(&once, ^{
    dispatch_semaphore_t ready = dispatch_semaphore_create(0);
    pthread_t thread;
    if (pthread_create(&thread, NULL, pf_syphon_thread_main, (__bridge void *)ready) != 0) {
      gLoadOk = 0;
      return;
    }
    pthread_detach(thread);
    dispatch_semaphore_wait(ready, DISPATCH_TIME_FOREVER);
  });
  return gLoadOk;
}

int pf_syphon_list(char *out, int cap) {
  return pf_try(^{
    if (!gBundle || cap <= 1) return 0;
    NSArray *servers = pf_servers();
    NSMutableArray *names = [NSMutableArray array];
    for (NSDictionary *desc in servers) {
      if (![desc isKindOfClass:[NSDictionary class]]) continue;
      NSString *name = pf_sender_label(desc);
      if (name.length) [names addObject:name];
    }
    if (names.count == 0 && !gLoggedEmpty) {
      gLoggedEmpty = YES;
      NSLog(@"[gpu-engine] syphon: directory has %lu servers", (unsigned long)servers.count);
      if (servers.count > 0) {
        NSDictionary *first = servers.firstObject;
        if ([first isKindOfClass:[NSDictionary class]]) {
          NSLog(@"[gpu-engine] syphon: first server keys %@", first.allKeys);
        }
      }
    }
    NSString *joined = [names componentsJoinedByString:@"\n"];
    const char *utf = joined.UTF8String ?: "";
    strncpy(out, utf, (size_t)cap - 1);
    out[cap - 1] = 0;
    return (int)strlen(out);
  });
}

static BOOL pf_pixel_format_is_bgra(MTLPixelFormat fmt) {
  return fmt == MTLPixelFormatBGRA8Unorm || fmt == MTLPixelFormatBGRA8Unorm_sRGB;
}

static void pf_copy_to_rgba(const unsigned char *src, size_t srcBpr, int w, int h, BOOL bgra, unsigned char *dst) {
  const size_t dstBpr = (size_t)w * 4;
  for (int y = 0; y < h; y++) {
    const unsigned char *row = src + (size_t)y * srcBpr;
    unsigned char *out = dst + (size_t)y * dstBpr;
    for (int x = 0; x < w; x++) {
      const unsigned char *p = row + (size_t)x * 4;
      if (bgra) {
        out[0] = p[2];
        out[1] = p[1];
        out[2] = p[0];
        out[3] = p[3];
      } else {
        memcpy(out, p, 4);
      }
      out += 4;
    }
  }
}

static void pf_store_frame(NSString *key, int w, int h, NSData *rgba) {
  if (!gFrameLock || !gFrames || !rgba) return;
  [gFrameLock lock];
  gFrames[key] = @{ @"w": @(w), @"h": @(h), @"rgba": rgba };
  [gFrameLock unlock];
}

static void pf_copy_client_frame(NSString *key, id client) {
  if (!client || !gDevice || !gQueue) return;
  SEL frameSel = @selector(newFrameImage);
  if (![client respondsToSelector:frameSel]) return;
  id (*newFrame)(id, SEL) = (id (*)(id, SEL))[client methodForSelector:frameSel];
  id tex = newFrame(client, frameSel);
  if (!tex) return;
  NSUInteger w = [tex width];
  NSUInteger h = [tex height];
  if (w == 0 || h == 0) return;
  MTLPixelFormat fmt = [tex pixelFormat];
  BOOL bgra = pf_pixel_format_is_bgra(fmt);
  size_t len = (size_t)w * (size_t)h * 4;

  IOSurfaceRef surf = NULL;
  if ([tex respondsToSelector:@selector(iosurface)]) {
    surf = ((IOSurfaceRef (*)(id, SEL))objc_msgSend)(tex, @selector(iosurface));
  }
  if (surf && IOSurfaceLock(surf, kIOSurfaceLockReadOnly, NULL) == kIOReturnSuccess) {
    const unsigned char *base = (const unsigned char *)IOSurfaceGetBaseAddress(surf);
    size_t bpr = IOSurfaceGetBytesPerRow(surf);
    if (base && bpr > 0) {
      NSMutableData *out = [NSMutableData dataWithLength:len];
      pf_copy_to_rgba(base, bpr, (int)w, (int)h, bgra || IOSurfaceGetPixelFormat(surf) == 'BGRA', out.mutableBytes);
      IOSurfaceUnlock(surf, kIOSurfaceLockReadOnly, NULL);
      pf_store_frame(key, (int)w, (int)h, out);
      return;
    }
    IOSurfaceUnlock(surf, kIOSurfaceLockReadOnly, NULL);
  }

  id<MTLBuffer> staging = [gDevice newBufferWithLength:len options:MTLResourceStorageModeShared];
  if (!staging) return;
  id<MTLCommandBuffer> cb = [gQueue commandBuffer];
  id<MTLBlitCommandEncoder> blit = [cb blitCommandEncoder];
  [blit copyFromTexture:tex
            sourceSlice:0
            sourceLevel:0
           sourceOrigin:MTLOriginMake(0, 0, 0)
             sourceSize:MTLSizeMake(w, h, 1)
               toBuffer:staging
      destinationOffset:0
 destinationBytesPerRow:w * 4
destinationBytesPerImage:len];
  [blit endEncoding];
  [cb commit];
  [cb waitUntilCompleted];
  if (cb.error) {
    NSLog(@"[gpu-engine] syphon blit: %@", cb.error);
    return;
  }
  NSMutableData *out = [NSMutableData dataWithLength:len];
  pf_copy_to_rgba((const unsigned char *)staging.contents, (size_t)w * 4, (int)w, (int)h, bgra, out.mutableBytes);
  pf_store_frame(key, (int)w, (int)h, out);
}

static int pf_ensure_client(NSString *key) {
  Class clientClass = NSClassFromString(@"SyphonMetalClient");
  if (!clientClass) return 0;
  NSDictionary *desc = pf_desc_for_name(key);
  if (!desc) return 0;
  NSString *uuid = pf_sender_uuid(desc);
  id client = gClients[key];
  if (client && uuid && gClientUUIDs[key] && ![gClientUUIDs[key] isEqualToString:uuid]) {
    [gClients removeObjectForKey:key];
    client = nil;
  }
  if (!client) {
    id alloced = [clientClass alloc];
    SEL sel = NSSelectorFromString(@"initWithServerDescription:device:options:newFrameHandler:");
    if (![alloced respondsToSelector:sel]) return 0;
    NSString *captured = [key copy];
    void (^handler)(id) = ^(id incoming) {
      pf_copy_client_frame(captured, incoming);
    };
    typedef id (*PFClientInit)(id, SEL, NSDictionary *, id, NSDictionary *, void (^)(id));
    PFClientInit initClient = (PFClientInit)[alloced methodForSelector:sel];
    client = initClient(alloced, sel, desc, gDevice, nil, handler);
    if (!client) return 0;
    gClients[key] = client;
    if (uuid) gClientUUIDs[key] = uuid;
  }
  pf_copy_client_frame(key, client);
  return 1;
}

static int pf_sync_on_syphon(int (^block)(void)) {
  if (!gSyphonLoop) return 0;
  if (CFRunLoopGetCurrent() == gSyphonLoop) return block();
  __block int result = 0;
  dispatch_semaphore_t done = dispatch_semaphore_create(0);
  CFRunLoopPerformBlock(gSyphonLoop, kCFRunLoopDefaultMode, ^{
    @autoreleasepool {
      result = block();
    }
    dispatch_semaphore_signal(done);
  });
  CFRunLoopWakeUp(gSyphonLoop);
  if (dispatch_semaphore_wait(done, dispatch_time(DISPATCH_TIME_NOW, 200 * NSEC_PER_MSEC)) != 0) {
    return 0;
  }
  return result;
}

int pf_syphon_receive(const char *name, unsigned char **rgba, int *width, int *height) {
  return pf_try(^{
    if (!gLoadOk || !name) return 0;
    NSString *key = pf_string(name);
    pf_sync_on_syphon(^{
      return pf_ensure_client(key);
    });
    [gFrameLock lock];
    NSDictionary *frame = gFrames[key];
    NSData *data = frame[@"rgba"];
    int w = [frame[@"w"] intValue];
    int h = [frame[@"h"] intValue];
    [gFrameLock unlock];
    if (!data || w <= 0 || h <= 0) return 0;
    unsigned char *buf = (unsigned char *)malloc(data.length);
    if (!buf) return 0;
    memcpy(buf, data.bytes, data.length);
    *rgba = buf;
    *width = w;
    *height = h;
    return 1;
  });
}

void pf_syphon_free(unsigned char *ptr) {
  free(ptr);
}

int pf_syphon_publish(const char *name, const unsigned char *rgba, int width, int height) {
  return pf_try(^{
  if (!gBundle || !gDevice || width <= 0 || height <= 0 || !rgba) return 0;
  NSString *key = pf_string(name);
  Class serverClass = NSClassFromString(@"SyphonMetalServer");
  if (!serverClass) return 0;
  id server = gServers[key];
  if (!server) {
    id alloced = [serverClass alloc];
    SEL sel = NSSelectorFromString(@"initWithName:device:options:");
    if (![alloced respondsToSelector:sel]) return 0;
    NSMethodSignature *sig = [alloced methodSignatureForSelector:sel];
    NSInvocation *inv = [NSInvocation invocationWithMethodSignature:sig];
    [inv setSelector:sel];
    [inv setTarget:alloced];
    [inv setArgument:&key atIndex:2];
    [inv setArgument:&gDevice atIndex:3];
    id opts = nil;
    [inv setArgument:&opts atIndex:4];
    [inv invoke];
    id created = pf_retained_return(inv);
    if (!created) return 0;
    server = created;
    gServers[key] = server;
  }
  NSString *texKey = [NSString stringWithFormat:@"%dx%d", width, height];
  id<MTLTexture> tex = gTextures[texKey];
  if (!tex || [tex width] != (NSUInteger)width || [tex height] != (NSUInteger)height) {
    MTLTextureDescriptor *td = [MTLTextureDescriptor texture2DDescriptorWithPixelFormat:MTLPixelFormatRGBA8Unorm
                                                                                  width:(NSUInteger)width
                                                                                 height:(NSUInteger)height
                                                                              mipmapped:NO];
    td.usage = MTLTextureUsageShaderRead;
    td.storageMode = MTLStorageModeShared;
    tex = [gDevice newTextureWithDescriptor:td];
    gTextures[texKey] = tex;
  }
  [tex replaceRegion:MTLRegionMake2D(0, 0, (NSUInteger)width, (NSUInteger)height)
         mipmapLevel:0
           withBytes:rgba
         bytesPerRow:(NSUInteger)width * 4];
  id<MTLCommandBuffer> cb = [gQueue commandBuffer];
  NSRect region = NSMakeRect(0, 0, width, height);
  NSMethodSignature *sig = [server methodSignatureForSelector:@selector(publishFrameTexture:onCommandBuffer:imageRegion:textureFlipped:)];
  if (sig) {
    NSInvocation *inv = [NSInvocation invocationWithMethodSignature:sig];
    [inv setSelector:@selector(publishFrameTexture:onCommandBuffer:imageRegion:textureFlipped:)];
    [inv setTarget:server];
    id t = tex;
    [inv setArgument:&t atIndex:2];
    [inv setArgument:&cb atIndex:3];
    [inv setArgument:&region atIndex:4];
    BOOL flipped = NO;
    [inv setArgument:&flipped atIndex:5];
    [inv invoke];
  }
  [cb commit];
  return 1;
  });
}
#else
int pf_syphon_load(void) { return 0; }
int pf_syphon_list(char *out, int cap) { (void)out; (void)cap; return 0; }
int pf_syphon_receive(const char *n, unsigned char **r, int *w, int *h) {
  (void)n; (void)r; (void)w; (void)h; return 0;
}
void pf_syphon_free(unsigned char *p) { (void)p; }
int pf_syphon_publish(const char *n, const unsigned char *r, int w, int h) {
  (void)n; (void)r; (void)w; (void)h; return 0;
}
#endif
