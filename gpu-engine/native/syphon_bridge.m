#ifdef __APPLE__
#import <Foundation/Foundation.h>
#import <Metal/Metal.h>
#include <stdlib.h>
#include <string.h>

static NSBundle *gBundle = nil;
static id gDevice = nil;
static id gQueue = nil;
static NSMutableDictionary *gClients = nil;
static NSMutableDictionary *gServers = nil;
static NSMutableDictionary *gTextures = nil;

static NSString *pf_string(const char *s) {
  if (!s) return @"";
  return [NSString stringWithUTF8String:s];
}

int pf_syphon_load(void) {
  if (gBundle) return 1;
  NSArray *paths = @[
    [[[NSBundle mainBundle] bundlePath] stringByAppendingPathComponent:@"../Frameworks/Syphon.framework"],
    [[NSBundle mainBundle] pathForResource:@"Syphon" ofType:@"framework"],
    @"/Library/Frameworks/Syphon.framework",
    @"/Users/Shared/Syphon.framework"
  ];
  const char *env = getenv("PIXELFORGE_SYPHON_FRAMEWORK");
  NSMutableArray *tryPaths = [paths mutableCopy];
  if (env) [tryPaths insertObject:pf_string(env) atIndex:0];
  for (NSString *p in tryPaths) {
    NSBundle *b = [NSBundle bundleWithPath:p];
    if (b && [b load]) {
      gBundle = b;
      break;
    }
  }
  if (!gBundle) return 0;
  gDevice = MTLCreateSystemDefaultDevice();
  gQueue = [gDevice newCommandQueue];
  gClients = [NSMutableDictionary dictionary];
  gServers = [NSMutableDictionary dictionary];
  gTextures = [NSMutableDictionary dictionary];
  return gDevice ? 1 : 0;
}

int pf_syphon_list(char *out, int cap) {
  if (!gBundle || cap <= 1) return 0;
  Class dirClass = NSClassFromString(@"SyphonServerDirectory");
  if (!dirClass) return 0;
  id dir = [dirClass performSelector:@selector(sharedDirectory)];
  NSArray *servers = [dir performSelector:@selector(servers)];
  NSMutableArray *names = [NSMutableArray array];
  for (NSDictionary *desc in servers) {
    NSString *name = desc[@"SyphonServerDescriptionNameKey"];
    if (!name) name = desc[@"name"];
    if (name.length) [names addObject:name];
  }
  NSString *joined = [names componentsJoinedByString:@"\n"];
  const char *utf = joined.UTF8String ?: "";
  strncpy(out, utf, (size_t)cap - 1);
  out[cap - 1] = 0;
  return (int)strlen(out);
}

static NSDictionary *pf_desc_for_name(NSString *name) {
  Class dirClass = NSClassFromString(@"SyphonServerDirectory");
  if (!dirClass) return nil;
  id dir = [dirClass performSelector:@selector(sharedDirectory)];
  NSArray *servers = [dir performSelector:@selector(servers)];
  for (NSDictionary *desc in servers) {
    NSString *n = desc[@"SyphonServerDescriptionNameKey"];
    if (!n) n = desc[@"name"];
    if (n && [n isEqualToString:name]) return desc;
  }
  return servers.firstObject;
}

int pf_syphon_receive(const char *name, unsigned char **rgba, int *width, int *height) {
  if (!gBundle || !gDevice) return 0;
  NSString *key = pf_string(name);
  id client = gClients[key];
  Class clientClass = NSClassFromString(@"SyphonMetalClient");
  if (!clientClass) return 0;
  if (!client) {
    NSDictionary *desc = pf_desc_for_name(key);
    if (!desc) return 0;
    id alloced = [clientClass alloc];
    SEL sel = NSSelectorFromString(@"initWithServerDescription:device:options:newFrameHandler:");
    if (![alloced respondsToSelector:sel]) return 0;
    NSMethodSignature *sig = [alloced methodSignatureForSelector:sel];
    NSInvocation *inv = [NSInvocation invocationWithMethodSignature:sig];
    [inv setSelector:sel];
    [inv setTarget:alloced];
    [inv setArgument:&desc atIndex:2];
    [inv setArgument:&gDevice atIndex:3];
    id opts = nil;
    id handler = nil;
    [inv setArgument:&opts atIndex:4];
    [inv setArgument:&handler atIndex:5];
    [inv invoke];
    [inv getReturnValue:&client];
    if (!client) return 0;
    gClients[key] = client;
  }
  id tex = [client performSelector:@selector(newFrameImage)];
  if (!tex) return 0;
  NSUInteger w = [tex width];
  NSUInteger h = [tex height];
  if (w == 0 || h == 0) return 0;
  MTLTextureDescriptor *td = [MTLTextureDescriptor texture2DDescriptorWithPixelFormat:MTLPixelFormatRGBA8Unorm
                                                                                width:w
                                                                               height:h
                                                                            mipmapped:NO];
  td.usage = MTLTextureUsageShaderRead | MTLTextureUsageShaderWrite;
  id<MTLTexture> cpuTex = [gDevice newTextureWithDescriptor:td];
  id<MTLCommandBuffer> cb = [gQueue commandBuffer];
  id<MTLBlitCommandEncoder> blit = [cb blitCommandEncoder];
  MTLOrigin origin = MTLOriginMake(0, 0, 0);
  MTLSize size = MTLSizeMake(w, h, 1);
  [blit copyFromTexture:tex sourceSlice:0 sourceLevel:0 sourceOrigin:origin sourceSize:size
              toTexture:cpuTex destinationSlice:0 destinationLevel:0 destinationOrigin:origin];
  [blit endEncoding];
  [cb commit];
  [cb waitUntilCompleted];
  NSUInteger bpr = w * 4;
  size_t len = (size_t)bpr * h;
  unsigned char *buf = (unsigned char *)malloc(len);
  if (!buf) return 0;
  [cpuTex getBytes:buf bytesPerRow:bpr fromRegion:MTLRegionMake2D(0, 0, w, h) mipmapLevel:0];
  *rgba = buf;
  *width = (int)w;
  *height = (int)h;
  return 1;
}

void pf_syphon_free(unsigned char *ptr) {
  free(ptr);
}

int pf_syphon_publish(const char *name, const unsigned char *rgba, int width, int height) {
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
    [inv getReturnValue:&server];
    if (!server) return 0;
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
