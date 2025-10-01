'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/components/ui/use-toast'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/dashboard'
  const { toast } = useToast()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const supabase = createClient()
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw error
      }

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

      toast({
        title: "Login successful",
        description: "Welcome back!",
      })

      // Refresh router to update server-side session
      router.refresh()
      
      // Small delay to ensure cookie is set
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Then redirect
      router.push(redirectTo)
    } catch (error: any) {
      toast({
        title: "Login failed",
        description: error.message || "An error occurred during login",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password !== confirmPassword) {
      toast({
        title: "Registration failed",
        description: "Passwords do not match",
      })
      return
    }
    
    setIsLoading(true)

    try {
      const supabase = createClient()
      
      // Sign up the user with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      })

      if (error) {
        throw error
      }

      // Create a record in the user_management table with a default role
      if (data.user && data.user.email) {
        const { error: userManagementError } = await supabase
          .from('user_management')
          .insert([
            {
              email: data.user.email,
              role: 'ADMIN', // Default role for new signups
              name: data.user.email?.split('@')[0] || 'User', // Default name from email
              created_at: new Date().toISOString(),
            }
          ])

        if (userManagementError) {
          console.error('Error creating user management record:', userManagementError)
          // We don't throw here because the auth was successful
          // But we should notify the admin about this issue
        }
      } else {
        console.error('User or user email is missing after registration')
      }

      toast({
        title: "Registration successful",
        description: "Please check your email to verify your account. You'll be assigned ADMIN role by default.",
      })

      // Reset form
      setEmail('')
      setPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message || "An error occurred during registration",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">Technician Service ERP</CardTitle>
          <CardDescription className="text-center">
            Login or register to access the admin panel
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Login</TabsTrigger>
              <TabsTrigger value="register">Register</TabsTrigger>
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
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Logging in...' : 'Login'}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="register">
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reg-email">Email</Label>
                  <Input
                    id="reg-email"
                    type="email"
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reg-password">Password</Label>
                  <Input
                    id="reg-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Creating account...' : 'Create Account'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}