'use client'

import { useState, Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { LoadingOverlay } from '@/components/ui/loading-state'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'
  const { toast } = useToast()

  // Reset loading state when component mounts (e.g., user navigates back)
  useEffect(() => {
    setIsLoading(false)
    setLoadingMessage('')
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate inputs
    if (!email || !password) {
      toast({
        title: "Validation Error",
        description: "Please enter both email and password",
        variant: "destructive"
      })
      return
    }

    if (!email.includes('@')) {
      toast({
        title: "Invalid Email",
        description: "Please enter a valid email address",
        variant: "destructive"
      })
      return
    }

    if (password.length < 6) {
      toast({
        title: "Invalid Password",
        description: "Password must be at least 6 characters",
        variant: "destructive"
      })
      return
    }

    setIsLoading(true)
    setLoadingMessage('Authenticating...')

    try {
      const supabase = createClient()
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (error) {
        console.error('Supabase auth error:', error)
        
        // Better error messages
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password')
        }
        if (error.message.includes('Email not confirmed')) {
          throw new Error('Please verify your email before logging in')
        }
        
        throw error
      }

      setLoadingMessage('Verifying permissions...')

      // Fetch user role from user_management table using auth_user_id
      const { data: userData, error: userError } = await supabase
        .from('user_management')
        .select('role, email, full_name')
        .eq('auth_user_id', data.user?.id)
        .single()

      if (userError) {
        console.error('Error fetching user role:', userError)
        console.error('User ID:', data.user?.id)
        console.error('User Email:', data.user?.email)
        
        // More helpful error message
        if (userError.code === 'PGRST116') {
          throw new Error('User not found in the system. Please contact an administrator to set up your account.')
        }
        
        throw new Error(`Error fetching user permissions: ${userError.message}`)
      }

      // Check if user has appropriate role
      if (!userData) {
        throw new Error('User not found in the system. Please contact an administrator to set up your account.')
      }

      if (!['SUPERADMIN', 'ADMIN'].includes(userData.role)) {
        throw new Error('You do not have permission to access this admin panel')
      }

      setLoadingMessage('Login successful! Loading dashboard...')

      toast({
        title: "Login successful",
        description: `Welcome back, ${userData.full_name || 'Admin'}!`,
      })

      // Refresh router to update server-side session
      router.refresh()
      
      // Small delay to ensure cookie is set and show success message
      await new Promise(resolve => setTimeout(resolve, 800))
      
      // Then redirect - loading state akan tetap sampai page benar-benar pindah
      router.push(redirectTo)
      
      // Keep loading state active - akan hilang saat component unmount
      // Ini memastikan overlay tetap ada sampai dashboard selesai load
    } catch (error: any) {
      console.error('Login error:', error)
      setLoadingMessage('')
      setIsLoading(false)
      toast({
        title: "Login failed",
        description: error.message || "An error occurred during login",
        variant: "destructive"
      })
    }
    // Note: Don't set isLoading to false in finally block
    // Let it stay true until page navigation completes
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate inputs
    if (!fullName.trim()) {
      toast({
        title: "Validation Error",
        description: "Nama lengkap harus diisi",
        variant: "destructive"
      })
      return
    }

    if (!email || !email.includes('@')) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive"
      })
      return
    }

    if (password.length < 6) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 6 characters",
        variant: "destructive"
      })
      return
    }
    
    if (password !== confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match",
        variant: "destructive"
      })
      return
    }
    
    setIsLoading(true)

    try {
      const supabase = createClient()
      
      // Sign up the user with Supabase Auth with display name
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            display_name: fullName.trim(),
          }
        }
      })

      if (error) {
        console.error('Supabase signup error:', error)
        
        // Better error messages
        if (error.message.includes('already registered')) {
          throw new Error('Email already registered. Please login instead.')
        }
        
        throw error
      }

      // Note: user_management record will be auto-created by trigger
      // The trigger will use the full_name from user metadata

      toast({
        title: "Registration successful",
        description: "Please check your email to verify your account. You'll be assigned ADMIN role by default.",
      })

      // Reset form
      setEmail('')
      setPassword('')
      setConfirmPassword('')
      setFullName('')
    } catch (error: any) {
      console.error('Registration error:', error)
      toast({
        title: "Registration failed",
        description: error.message || "An error occurred during registration",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <LoadingOverlay 
        isLoading={isLoading} 
        message={loadingMessage || 'Loading...'}
        className="w-full max-w-md"
      >
        <Card className="w-full max-w-md">
          <CardHeader className="space-y-4">
            <div className="flex justify-center py-4">
              <img 
                src="/logo.png" 
                alt="MSN ERP" 
                className="h-24 w-auto"
              />
            </div>
            <CardDescription className="text-center">
              Login or register to access the admin panel
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login" disabled={isLoading}>Login</TabsTrigger>
                <TabsTrigger value="register" disabled={isLoading}>Register</TabsTrigger>
              </TabsList>
              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="pr-10"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isLoading}
                        className="absolute right-3 top-1/2 -translate-y-1/2 z-10 cursor-pointer text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging in...
                    </>
                  ) : (
                    'Login'
                  )}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-fullname">Nama Lengkap</Label>
                  <Input
                    id="reg-fullname"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Password</Label>
                  <div className="relative">
                    <Input
                      id="reg-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="pr-10"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-10 cursor-pointer text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="pr-10"
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      disabled={isLoading}
                      className="absolute right-3 top-1/2 -translate-y-1/2 z-10 cursor-pointer text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      </LoadingOverlay>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
